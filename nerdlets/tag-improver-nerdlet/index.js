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
    activeTagHierarchy: {},
    entityTagsMap: {},
    entityTypesMap: {},
    entityTypesEntityCount: {},
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
    }
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
  };

  updateSelectedEntityType = entityType => {
    const {
      tagHierarchy,
      loadedEntities,
      entityTypesMap,
      entityTypesEntityCount
    } = this.state;

    this.setState({
      selectedEntityType: entityType,
      activeTagHierarchy:
        // eslint-disable-next-line no-nested-ternary
        entityType.id === 'all'
          ? tagHierarchy
          : entityTypesMap[entityType.value]
          ? entityTypesMap[entityType.value]
          : {},
      entityCount:
        entityType.id === 'all'
          ? loadedEntities
          : entityTypesEntityCount[entityType],

      // reset all variables to load fresh data for newly selected entity type
      tagHierarchy: {},
      entityTagsMap: {},
      entityTypesMap: {},
      entityTypesEntityCount: {},
      loadedEntities: 0,
      doneLoading: false,
      queryCursor: undefined,
      accountId: null,
      taggingPolicy: null,
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
        entityTypesMap: {},
        entityCount: 0,
        loadedEntities: 0,
        doneLoading: false,
        queryCursor: undefined
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

    const query = `
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
      state: { loadedEntities, tagHierarchy, accountId }
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
      nextCursor = ngCursor || undefined;
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
        } else {
          this.setState({ activeTagHierarchy: tagHierarchy });
        }
      }
    );
  };

  processLoadedEntityTags = entities => {
    const {
      tagHierarchy,
      entityTagsMap,
      taggingPolicy,
      mandatoryTagCount,
      entityTypesMap,
      entityTypesEntityCount
    } = this.state;
    entities.reduce((acc, entity) => {
      // get all the tags
      const { guid, tags, entityType } = entity;
      entityTagsMap[guid] = [...tags];

      this.updateEntityTagCompliance(entity, taggingPolicy, mandatoryTagCount);

      if (!entityTypesMap[entityType]) entityTypesMap[entityType] = [];
      if (!entityTypesEntityCount[entityType])
        entityTypesEntityCount[entityType] = 0;

      // for each tag, if it doesn't make an empty object
      tags.forEach(({ tagKey, tagValues }) => {
        if (!acc[tagKey]) acc[tagKey] = {};
        if (!entityTypesMap[entityType][tagKey])
          entityTypesMap[entityType][tagKey] = {};
        // for each tag value, check if it exists, if it doesn't make it an empty object
        tagValues.forEach(value => {
          if (!acc[tagKey][value]) acc[tagKey][value] = [];
          if (!entityTypesMap[entityType][tagKey][value])
            entityTypesMap[entityType][tagKey][value] = [];
          acc[tagKey][value].push(entity);
          entityTypesMap[entityType][tagKey][value].push(entity);
        });
      });
      entityTypesEntityCount[entityType] += 1;
      return acc;
    }, tagHierarchy);

    return tagHierarchy;
  };

  updateEntityTagCompliance(entity, taggingPolicy, mandatoryTagCount) {
    // calculate entity tag compliance score
    entity.mandatoryTags = [];
    entity.optionalTags = [];
    let compliance = 0;

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
    entity.complianceScore = compliance
      ? (compliance / mandatoryTagCount) * 100
      : 0;
  }

  getTaggingPolicy = () => {
    UserStorageQuery.query({
      collection: 'nr1-tag-improver',
      documentId: 'tagging-policy'
    })
      .then(({ data }) => {
        this.setState({
          taggingPolicy: sortedPolicy(data.policy),
          mandatoryTagCount:
            data.policy.filter(tag => tag.enforcement === 'required').length ||
            0
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

  updatePolicy = policy => {
    this.setState({
      taggingPolicy: sortedPolicy(policy),
      mandatoryTagCount:
        policy.filter(tag => tag.enforcement === 'required').length || 0
    });
  };

  render() {
    const {
      doneLoading,
      entityCount,
      loadedEntities,
      activeTagHierarchy,
      entityTagsMap,
      entityTypesEntityCount,
      taggingPolicy,
      accountId,
      selectedEntityType
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
                onChange={this.onChangeTab}
              >
                <TabsItem value="policy-tab" label="Policy">
                  <TaggingPolicy
                    accountId={accountId}
                    tagHierarchy={activeTagHierarchy}
                    selectedEntityType={selectedEntityType}
                    entityCount={
                      selectedEntityType.id === 'all'
                        ? entityCount
                        : entityTypesEntityCount[selectedEntityType.value]
                    }
                    loadedEntities={loadedEntities}
                    doneLoading={doneLoading}
                    schema={taggingPolicy}
                    updatePolicy={this.updatePolicy}
                  />
                </TabsItem>
                <TabsItem value="coverage-tab" label="Tag analyzer">
                  <TagCoverageView
                    tagHierarchy={activeTagHierarchy}
                    selectedEntityType={selectedEntityType}
                    entityCount={
                      selectedEntityType.id === 'all'
                        ? entityCount
                        : entityTypesEntityCount[selectedEntityType.value]
                    }
                    loadedEntities={loadedEntities}
                    doneLoading={doneLoading}
                    height={this.props.height}
                  />
                </TabsItem>
                <TabsItem value="entity-tab" label="Entities">
                  <TagEntityView
                    tagHierarchy={activeTagHierarchy}
                    selectedEntityType={selectedEntityType}
                    entityCount={
                      selectedEntityType.id === 'all'
                        ? entityCount
                        : entityTypesEntityCount[selectedEntityType.value]
                    }
                    loadedEntities={loadedEntities}
                    doneLoading={doneLoading}
                    entityTagsMap={entityTagsMap}
                    reloadTagsFn={this.startLoadingEntityTags}
                    tagsObject={tagsObject(taggingPolicy)}
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
