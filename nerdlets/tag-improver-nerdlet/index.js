import React from 'react';
import PropTypes from 'prop-types';

import {
  Dropdown,
  DropdownItem,
  NerdGraphQuery,
  Spinner,
  Tabs,
  TabsItem,
  nerdlet,
  PlatformStateContext,
  NerdletStateContext,
  UserStorageQuery,
  logger
} from 'nr1';

import { SCHEMA, ENFORCEMENT_PRIORITY, ENTITY_TYPES } from './tag-schema';

import TagCoverageView from './components/tag-coverage';
import TagEntityView from './components/tag-entity-view';
import TaggingPolicy from './components/tag-policy';

export default class TagVisualizer extends React.Component {
  static propTypes = {
    height: PropTypes.number
  };

  state = {
    tagHierarchy: {},
    entityTagsMap: {},
    entityCount: 0,
    loadedEntities: 0,
    doneLoading: false,
    queryCursor: undefined,
    accountId: null,
    taggingPolicy: null,
    mandatoryTagCount: 0,
    selectedEntityType: {
      id: 'APM',
      name: 'Application',
      value: 'APM_APPLICATION_ENTITY'
    },
    selectedTagKey: '',
    selectedTagValue: '',
    currentTab: 'policy-tab'
  };

  componentDidMount() {
    nerdlet.setConfig({
      timePicker: false,
      accountPicker: true,
      accountPickerValues: [
        nerdlet.ACCOUNT_PICKER_VALUE.CROSS_ACCOUNT,
        ...nerdlet.ACCOUNT_PICKER_DEFAULT_VALUES
      ]
    });
    this.setState({ accountId: this.context.accountId }, () => {
      this.getTaggingPolicy();
      this.startLoadingEntityTags();
    });
  }

  componentDidUpdate() {
    if (this.context.accountId !== this.state.accountId) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState(
        { accountId: this.context.accountId, taggingPolicy: null },
        () => this.getTaggingPolicy(),
        this.startLoadingEntityTags()
      );
    }
  }

  static contextType = PlatformStateContext;

  onChangeTab = newTab => {
    nerdlet.setUrlState({ tab: newTab });
    this.setState({ currentTab: newTab }, () => {
      if (newTab !== 'entity-tab') {
        this.setState({
          // selectedTagKey: '',
          selectedTagValue: ''
        });
      }
    });
  };

  onUpdateEntitiesFilter = item => {
    this.setState({
      selectedTagKey: item.tagKey,
      selectedTagValue: item.tagValue
    });
  };

  onShowEntities = item => {
    this.onUpdateEntitiesFilter(item);
    nerdlet.setUrlState({ tab: 'entity-tab' });
    this.setState({
      currentTab: 'entity-tab'
    });
  };

  updateSelectedEntityType = entityType => {
    const { loadedEntities } = this.state;

    this.setState({
      selectedEntityType: entityType,
      entityCount: loadedEntities,
      // reset all variables to load fresh data for newly selected entity type
      tagHierarchy: {},
      entityTagsMap: {},
      loadedEntities: 0,
      doneLoading: false,
      queryCursor: undefined,
      accountId: null,
      taggingPolicy: null,
      selectedTagKey: '',
      selectedTagValue: '',
      mandatoryTagCount: 0
    });
  };

  /**
   * Loading the tagset for all entities is a bit of a chore.
   *
   * The code below implements a progressive loader that handles the paginated entity query api,
   * unpacking tags from each entity, and building a global tag histogram.
   */
  startLoadingEntityTags = () => {
    // reset all cached state and then fetch the first page of entity results...
    const { loadEntityBatch } = this;

    this.setState(
      {
        tagHierarchy: {},
        entityTagsMap: {},
        entityCount: 0,
        loadedEntities: 0,
        doneLoading: false,
        queryCursor: undefined,
        selectedTagKey: '',
        selectedTagValue: ''
      },
      () => {
        loadEntityBatch();
      }
    );
  };

  loadEntityBatch = () => {
    const {
      processEntityQueryResults,
      state: { queryCursor, accountId, selectedEntityType }
    } = this;

    let query;
    const variables = {
      // queryString: `domain in ('APM', 'MOBILE', 'BROWSER', 'DASHBOARD', 'WORKLOAD')${
      queryString: `domain = '${selectedEntityType.id}' ${
        accountId && accountId !== 'cross-account'
          ? `AND accountId = '${accountId}'`
          : ''
      }`
    };
    if (queryCursor) {
      variables.nextCursor = queryCursor;
      query = `
      query EntitiesSearchQuery($queryString: String!, $nextCursor: String) {
        actor {
          entitySearch(query: $queryString) {
            count
            results(cursor: $nextCursor) {
              entities {
                name
                entityType
                guid
                accountId
                tags {
                  tagKey: key
                  tagValues: values
                }
              }
              nextCursor
            }
          }
        }
      }
      `;
    } else {
      query = `
      query EntitiesSearchQuery($queryString: String!) {
        actor {
          entitySearch(query: $queryString) {
            count
            results {
              entities {
                name
                entityType
                guid
                accountId
                tags {
                  tagKey: key
                  tagValues: values
                }
              }
              nextCursor
            }
          }
        }
      }
      `;
    }

    NerdGraphQuery.query({
      query,
      variables
    })
      .then(({ data, errors }) => {
        if (data) {
          processEntityQueryResults(
            data.actor.entitySearch.results.entities,
            data.actor.entitySearch.count,
            data.actor.entitySearch.results.nextCursor
          );
        } else {
          logger.log('data is NOT truthy %O', data);
        }
        if (errors) {
          logger.error('Entity query error %O', errors);
        }
      })
      .catch(err => {
        logger.error(err.toString());
      });
  };

  processEntityQueryResults = (entitiesToProcess, count, ngCursor) => {
    const {
      loadEntityBatch,
      state: { loadedEntities, accountId }
    } = this;
    if (accountId !== this.state.accountId) {
      return;
    }
    let entityCount = 0;
    let entities = [];
    let nextCursor;
    try {
      entityCount = count;
      entities = entitiesToProcess || [];
      nextCursor = ngCursor || "";
    } catch (err) {
      logger.error('Error parsing results %O', err);
    }
    this.processLoadedEntityTags(entities);

    this.setState(
      {
        queryCursor: nextCursor,
        entityCount,
        loadedEntities: loadedEntities + entities.length,
        doneLoading: !nextCursor
      },
      () => {
        if (nextCursor && accountId === this.state.accountId) {
          loadEntityBatch();
        }
      }
    );
  };

  processLoadedEntityTags = entities => {
    const {
      tagHierarchy,
      entityTagsMap,
      taggingPolicy,
      mandatoryTagCount
    } = this.state;

    if (!Object.keys(tagHierarchy).length) {
      for (const tag of taggingPolicy) {
        tagHierarchy[tag.key] = {};
      }
    }
    entities.reduce((acc, entity) => {
      // get all the tags
      const { guid, tags } = entity;
      entityTagsMap[guid] = [...tags];

      this.updateEntityTagCompliance(entity, taggingPolicy, mandatoryTagCount);

      // for each tag, if it doesn't make an empty object
      for (const tag of tags) {
        if (!acc[tag.tagKey]) acc[tag.tagKey] = {};
        // for each tag value, check if it exists, if it doesn't make it an empty object
        for (const value of tag.tagValues) {
          if (!acc[tag.tagKey][value]) acc[tag.tagKey][value] = [];
          acc[tag.tagKey][value].push(entity);
        }
      }
      return acc;
    }, tagHierarchy);

    return tagHierarchy;
  };

  updateEntityTagCompliance(entity, taggingPolicy, mandatoryTagCount) {
    // calculate entity tag compliance score
    entity.mandatoryTags = [];
    entity.optionalTags = [];
    let compliance = 0.0;

    if (!taggingPolicy) return;

    for (const tagPolicy of taggingPolicy) {
      if (!tagPolicy) continue;
      const found = entity.tags.find(tag => tag.tagKey === tagPolicy.key);
      const entityTag = {
        tagKey: tagPolicy.key,
        tagValues: found ? found.tagValues : ['---']
      };

      if (tagPolicy.enforcement === 'required') {
        entity.mandatoryTags.push(entityTag);
        if (found) compliance += 1;
      } else if (tagPolicy.enforcement === 'optional') {
        entity.optionalTags.push(entityTag);
      }
    }
    entity.complianceScore =
      compliance && mandatoryTagCount
        ? (compliance / mandatoryTagCount) * 100
        : 0;
  }

  getTaggingPolicy = () => {
    UserStorageQuery.query({
      collection: 'nr1-tag-improver',
      documentId: 'tagging-policy'
    })
      .then(({ data }) => {
        const taggingPolicy = data.policy.length ? data.policy : SCHEMA;
        this.setState({
          taggingPolicy: sortedPolicy(taggingPolicy),
          mandatoryTagCount:
            taggingPolicy.filter(tag => tag.enforcement === 'required')
              .length || 0
        });
      })
      .catch(() => {
        this.setState({
          taggingPolicy: sortedPolicy(SCHEMA),
          mandatoryTagCount:
            SCHEMA.filter(tag => tag.enforcement === 'required').length || 0
        });
      });
  };

  updatePolicy = (policy, prevPolicy) => {
    this.setState(
      {
        taggingPolicy: sortedPolicy(policy),
        mandatoryTagCount:
          policy.filter(tag => tag.enforcement === 'required').length || 0
      },
      () => {
        const { tagHierarchy, mandatoryTagCount } = this.state;
        const { updateEntityTagCompliance } = this;

        // check if policy was changed
        if (
          JSON.stringify(sortedPolicy(policy)) !==
          JSON.stringify(sortedPolicy(prevPolicy))
        ) {
          // add new policy tags to tagHierarchy if not present (not likely)
          for (const tag of policy) {
            if (!tagHierarchy[tag.key]) tagHierarchy[tag.key] = {};
          }
          // remove tags that were removed from ploicy and are not used by any entity
          for (const tag of prevPolicy) {
            if (
              !policy.find(policyTag => {
                return policyTag.key === tag.key;
              })
            )
              if (!Object.keys(tagHierarchy[tag.key]).length)
                delete tagHierarchy[tag.key];
          }
        }

        for (const tagKey of Object.entries(tagHierarchy)) {
          for (const tagValue of Object.values(tagKey[1])) {
            for (const entity of tagValue) {
              updateEntityTagCompliance(entity, policy, mandatoryTagCount);
            }
          }
        }
      }
    );
  };

  render() {
    const {
      doneLoading,
      tagHierarchy,
      entityCount,
      loadedEntities,
      entityTagsMap,
      taggingPolicy,
      accountId,
      selectedEntityType,
      selectedTagKey,
      selectedTagValue,
      currentTab
    } = this.state;

    return (
      <>
        <NerdletStateContext.Consumer>
          {nerdletState => (
            <>
              <div
                className="status"
                style={{
                  height: '24px',
                  display: 'flex',
                  flexDirection: 'row',
                  lineHeight: '24px',
                  paddingBottom: '9px'
                }}
              >
                Entity type:
                <Dropdown
                  style={{ marginLeft: '0' }}
                  title={selectedEntityType.name}
                  items={ENTITY_TYPES}
                >
                  {({ item, index }) => (
                    <DropdownItem
                      key={`e-${index}`}
                      onClick={() => this.updateSelectedEntityType(item)}
                    >
                      {item.name}
                    </DropdownItem>
                  )}
                </Dropdown>
              </div>
              {doneLoading ? null : (
                <div className="status">
                  Loading tags... ({loadedEntities} / {entityCount} entities
                  examined)
                  <Spinner inline />
                </div>
              )}

              <Tabs
                defaultValue={(nerdletState || {}).tab || 'overview-tab'}
                value={(nerdletState || {}).tab || currentTab}
                onChange={this.onChangeTab}
              >
                <TabsItem value="policy-tab" label="Policy">
                  <TaggingPolicy
                    accountId={accountId}
                    tagHierarchy={tagHierarchy}
                    selectedEntityType={selectedEntityType}
                    entityCount={entityCount}
                    loadedEntities={loadedEntities}
                    doneLoading={doneLoading}
                    schema={taggingPolicy}
                    updatePolicy={this.updatePolicy}
                  />
                </TabsItem>
                <TabsItem value="coverage-tab" label="Tag analyzer">
                  <TagCoverageView
                    tagHierarchy={tagHierarchy}
                    selectedEntityType={selectedEntityType}
                    entityCount={entityCount}
                    loadedEntities={loadedEntities}
                    doneLoading={doneLoading}
                    taggingPolicy={taggingPolicy}
                    getTagKeys={getTagKeys(tagHierarchy, taggingPolicy)}
                    height={this.props.height}
                    onUpdateEntitiesFilter={this.onUpdateEntitiesFilter}
                    onShowEntities={this.onShowEntities}
                  />
                </TabsItem>
                <TabsItem value="entity-tab" label="Entities">
                  <TagEntityView
                    tagHierarchy={tagHierarchy}
                    selectedEntityType={selectedEntityType}
                    entityCount={entityCount}
                    loadedEntities={loadedEntities}
                    doneLoading={doneLoading}
                    entityTagsMap={entityTagsMap}
                    reloadTagsFn={this.startLoadingEntityTags}
                    getTagKeys={getTagKeys(tagHierarchy, taggingPolicy)}
                    selectedTagKey={selectedTagKey}
                    selectedTagValue={selectedTagValue}
                  />
                </TabsItem>
              </Tabs>
            </>
          )}
        </NerdletStateContext.Consumer>
      </>
    );
  }
}

function sortedPolicy(policy) {
  const p = policy && policy.length > 0 ? policy : SCHEMA;
  return p.sort((a, b) => {
    const pa = ENFORCEMENT_PRIORITY[a.enforcement] || 99;
    const pb = ENFORCEMENT_PRIORITY[b.enforcement] || 99;
    if (pa < pb) return 1;
    if (pa > pb) return -1;
    return a.key.localeCompare(b.key, undefined, { sensitivity: 'base' });
  });
}

function tagsObject(policy) {
  return (policy || []).reduce(
    (acc, cur) =>
      acc[cur.enforcement] // cur.enforcement may not exist if a breaking change is made to the poliy schema and the user has a custom policy saved under the old schema
        ? Object.assign(acc, acc[cur.enforcement].push(cur.key))
        : acc,
    { required: [], optional: [] }
  );
}

function getTagKeys(tagHierarchy, policy) {
  const tagsForDropdown = [];
  tagsForDropdown.push({
    title: 'required',
    array: tagsObject(policy).required
  });
  tagsForDropdown.push({
    title: 'optional',
    array: tagsObject(policy).optional
  });
  tagsForDropdown.push({ title: 'not in policy', array: [] });

  const items = Object.keys(tagHierarchy)
    .reduce(
      (acc, tag) => {
        let idx = tagsForDropdown.findIndex(t => t.array.includes(tag));
        if (idx < 0) idx = 2; // push into 'not in policy'
        acc[idx].push(tag);
        return acc;
      },
      [[], [], []]
    )
    .map(tags =>
      tags.sort((tag1, tag2) =>
        tag1.toLowerCase().localeCompare(tag2.toLowerCase())
      )
    );

  tagsForDropdown.map((section, i) => (tagsForDropdown[i].items = items[i]));

  return tagsForDropdown;
}
