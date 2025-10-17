import React from 'react';
import PropTypes from 'prop-types';

import {
  Dropdown,
  DropdownItem,
  NerdGraphQuery,
  Spinner,
  Icon,
  Tabs,
  TabsItem,
  nerdlet,
  PlatformStateContext,
  NerdletStateContext,
  AccountStorageQuery,
  UserStorageQuery,
  logger,
} from 'nr1';

import { HelpModal, Messages } from '@newrelic/nr-labs-components';

import { SCHEMA, ENFORCEMENT_PRIORITY, ENTITY_TYPES } from './tag-schema';

import TagCoverageView from './components/tag-coverage';
import TagEntityView from './components/tag-entity-view';
import TaggingPolicy from './components/tag-policy';

const STORAGE_TYPES = {
  GLOBAL: 'global',
  USER: 'user',
};

export default class TagVisualizer extends React.Component {
  static propTypes = {
    height: PropTypes.number,
  };

  state = {
    helpModalOpen: false,
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
      attribute: 'domain',
      id: 'APM',
      name: 'APM Service',
    },
    selectedTagKey: '',
    selectedTagValue: '',
    currentTab: 'policy-tab',
    storageType: STORAGE_TYPES.GLOBAL,
  };

  componentDidMount() {
    nerdlet.setConfig({
      timePicker: false,
      accountPicker: true,
      accountPickerValues: [
        nerdlet.ACCOUNT_PICKER_VALUE.CROSS_ACCOUNT,
        ...nerdlet.ACCOUNT_PICKER_DEFAULT_VALUES,
      ],
      actionControls: true,
      actionControlButtons: [
        {
          label: 'Help',
          hint: 'Quick links to get support',
          type: 'primary',
          iconType: Icon.TYPE.INTERFACE__INFO__HELP,
          onClick: () => this.setHelpModalOpen(true),
        },
      ],
    });
    this.setState({ accountId: this.context.accountId }, () => {
      this.getTaggingPolicy().then(() => {
        this.startLoadingEntityTags();
      });
    });
  }

  componentDidUpdate() {
    if (this.context.accountId !== this.state.accountId) {
      this.setState(
        {
          accountId: this.context.accountId,
          taggingPolicy: null,
          tagHierarchy: {},
          entityTagsMap: {},
          entityCount: 0,
          loadedEntities: 0,
          doneLoading: false,
          queryCursor: undefined,
          selectedTagKey: '',
          selectedTagValue: '',
        },
        () => {
          this.getTaggingPolicy().then(() => {
            this.startLoadingEntityTags();
          });
        }
      );
    }
  }

  static contextType = PlatformStateContext;

  onChangeTab = (newTab) => {
    nerdlet.setUrlState({ tab: newTab });
    this.setState({ currentTab: newTab }, () => {
      if (newTab !== 'entity-tab') {
        this.setState({
          // selectedTagKey: '',
          selectedTagValue: '',
        });
      }
    });
  };

  onUpdateEntitiesFilter = (item) => {
    this.setState({
      selectedTagKey: item.tagKey,
      selectedTagValue: item.tagValue,
    });
  };

  onShowEntities = (item) => {
    this.onUpdateEntitiesFilter(item);
    nerdlet.setUrlState({ tab: 'entity-tab' });
    this.setState({
      currentTab: 'entity-tab',
    });
  };

  updateSelectedEntityType = (entityType) => {
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
      mandatoryTagCount: 0,
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
        selectedTagValue: '',
      },
      () => {
        loadEntityBatch();
      }
    );
  };

  loadEntityBatch = () => {
    const {
      processEntityQueryResults,
      state: { queryCursor, accountId, selectedEntityType },
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
      queryString: `${selectedEntityType.attribute} = '${
        selectedEntityType.id
      }' ${
        accountId && accountId !== 'cross-account'
          ? `AND accountId = '${accountId}'`
          : ''
      }`,
    };
    if (queryCursor) {
      variables.nextCursor = queryCursor;
    }

    NerdGraphQuery.query({
      query,
      variables,
    })
      .then(({ data, error }) => {
        if (data) {
          processEntityQueryResults(
            data.actor.entitySearch.results.entities,
            data.actor.entitySearch.count,
            data.actor.entitySearch.results.nextCursor
          );
        } else {
          logger.log('data is NOT truthy %O', data);
        }
        if (error?.graphQLErrors) {
          logger.error('Entity query error %O', error?.graphQLErrors);
        }
      })
      .catch((err) => {
        logger.error(err.toString());
      });
  };

  processEntityQueryResults = (entitiesToProcess, count, ngCursor) => {
    const {
      loadEntityBatch,
      state: { loadedEntities, accountId },
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
        doneLoading: !nextCursor,
      },
      () => {
        if (nextCursor && accountId === this.state.accountId) {
          loadEntityBatch();
        }
      }
    );
  };

  processLoadedEntityTags = (entities) => {
    const { tagHierarchy, entityTagsMap, taggingPolicy, mandatoryTagCount } =
      this.state;

    if (!Object.keys(tagHierarchy).length && taggingPolicy) {
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
      const found = entity.tags.find((tag) => tag.tagKey === tagPolicy.key);
      const entityTag = {
        tagKey: tagPolicy.key,
        tagValues: found ? found.tagValues : ['---'],
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
    const { storageType } = this.state;
    const isGlobalStorage = storageType === STORAGE_TYPES.GLOBAL;

    if (isGlobalStorage) {
      return NerdGraphQuery.query({
        query: `
          {
            actor {
              organization {
                storageAccountId
              }
            }
          }
        `,
      })
        .then(({ data }) => {
          const storageAccountId = data?.actor?.organization?.storageAccountId;
          if (!storageAccountId) {
            throw new Error('Unable to get organization storage account ID');
          }

          return AccountStorageQuery.query({
            accountId: storageAccountId,
            collection: 'nr1-tag-improver',
            documentId: 'tagging-policy',
          });
        })
        .then(({ data }) => {
          const taggingPolicy =
            data && data.policy && data.policy.length ? data.policy : SCHEMA;
          return new Promise((resolve) => {
            this.setState(
              {
                taggingPolicy: sortedPolicy(taggingPolicy),
                mandatoryTagCount:
                  taggingPolicy.filter((tag) => tag.enforcement === 'required')
                    .length || 0,
              },
              resolve
            );
          });
        })
        .catch(() => {
          return new Promise((resolve) => {
            this.setState(
              {
                taggingPolicy: sortedPolicy(SCHEMA),
                mandatoryTagCount:
                  SCHEMA.filter((tag) => tag.enforcement === 'required')
                    .length || 0,
              },
              resolve
            );
          });
        });
    } else {
      return UserStorageQuery.query({
        collection: 'nr1-tag-improver',
        documentId: 'tagging-policy',
      })
        .then(({ data }) => {
          const taggingPolicy =
            data && data.policy && data.policy.length ? data.policy : SCHEMA;
          return new Promise((resolve) => {
            this.setState(
              {
                taggingPolicy: sortedPolicy(taggingPolicy),
                mandatoryTagCount:
                  taggingPolicy.filter((tag) => tag.enforcement === 'required')
                    .length || 0,
              },
              resolve
            );
          });
        })
        .catch(() => {
          return new Promise((resolve) => {
            this.setState(
              {
                taggingPolicy: sortedPolicy(SCHEMA),
                mandatoryTagCount:
                  SCHEMA.filter((tag) => tag.enforcement === 'required')
                    .length || 0,
              },
              resolve
            );
          });
        });
    }
  };

  updatePolicy = (policy, prevPolicy) => {
    this.setState(
      {
        taggingPolicy: sortedPolicy(policy),
        mandatoryTagCount:
          policy.filter((tag) => tag.enforcement === 'required').length || 0,
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
              !policy.find((policyTag) => {
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

  setHelpModalOpen = (helpModalOpen) => {
    this.setState({ helpModalOpen });
  };

  onStorageTypeChange = (_, newStorageType) => {
    this.setState(
      {
        storageType: newStorageType,
        taggingPolicy: null,
        tagHierarchy: {},
        entityTagsMap: {},
        entityCount: 0,
        loadedEntities: 0,
        doneLoading: false,
        queryCursor: undefined,
        selectedTagKey: '',
        selectedTagValue: '',
      },
      () => {
        this.getTaggingPolicy().then(() => {
          this.startLoadingEntityTags();
        });
      }
    );
  };

  render() {
    const {
      helpModalOpen,
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
      currentTab,
      storageType,
    } = this.state;

    return (
      <>
        <Messages repo="nr1-tag-improver" branch="main" />
        <NerdletStateContext.Consumer>
          {(nerdletState) => (
            <>
              <div
                className="status"
                style={{
                  height: '24px',
                  display: 'flex',
                  flexDirection: 'row',
                  lineHeight: '24px',
                  paddingBottom: '9px',
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
                    storageType={storageType}
                    onStorageTypeChange={this.onStorageTypeChange}
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
        <HelpModal
          isModalOpen={helpModalOpen}
          setModalOpen={this.setHelpModalOpen}
          urls={{
            docs: 'https://github.com/newrelic/nr1-tag-improver#readme',
            createIssue:
              'https://github.com/newrelic/nr1-tag-improver/issues/new?assignees=&labels=bug%2C+needs-triage&template=bug_report.md&title=',
            createFeature:
              'https://github.com/newrelic/nr1-tag-improver/issues/new?assignees=&labels=enhancement%2C+needs-triage&template=enhancement.md&title=',
            createQuestion:
              'https://github.com/newrelic/nr1-tag-improver/discussions/new/choose',
          }}
          ownerBadge={{
            logo: {
              src: 'https://drive.google.com/thumbnail?id=1BdXVy2X34rufvG4_1BYb9czhLRlGlgsT',
              alt: 'New Relic Labs',
            },
            blurb: {
              text: 'This is a New Relic Labs open source app.',
              link: {
                text: 'Take a look at our other repos',
                url: 'https://github.com/newrelic?q=nrlabs-viz&type=all&language=&sort=',
              },
            },
          }}
        />
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
    array: tagsObject(policy).required,
  });
  tagsForDropdown.push({
    title: 'optional',
    array: tagsObject(policy).optional,
  });
  tagsForDropdown.push({ title: 'not in policy', array: [] });

  const items = Object.keys(tagHierarchy)
    .reduce(
      (acc, tag) => {
        let idx = tagsForDropdown.findIndex((t) => t.array.includes(tag));
        if (idx < 0) idx = 2; // push into 'not in policy'
        acc[idx].push(tag);
        return acc;
      },
      [[], [], []]
    )
    .map((tags) =>
      tags.sort((tag1, tag2) =>
        tag1.toLowerCase().localeCompare(tag2.toLowerCase())
      )
    );

  tagsForDropdown.map((section, i) => (tagsForDropdown[i].items = items[i]));

  return tagsForDropdown;
}
