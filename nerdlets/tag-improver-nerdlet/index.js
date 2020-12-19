import React from 'react';
import {
  Dropdown,
  DropdownItem,
  HeadingText,
  NerdGraphQuery,
  Spinner,
  Tabs,
  TabsItem,
  nerdlet,
  PlatformStateContext,
  NerdletStateContext,
  AccountStorageQuery,
  UserStorageQuery,
  AccountStorageMutation,
  UserStorageMutation
} from 'nr1';

import { SCHEMA, ENFORCEMENT_PRIORITY } from './tag-schema';

import TagCoverageView from './components/tag-coverage';
import TagEntityView from './components/tag-entity-view';
import TaggingPolicy from './components/tag-policy';

export default class TagVisualizer extends React.Component {
  static contextType = PlatformStateContext;
  state = {
    tagHierarchy: {},
    activeTagHierarchy: {},
    entityTagsMap: {},
    entityTypesMap: {},
    entityTypesEntityCount: {},
    entityCount: 0,
    loadedEntities: 0,
    doneLoading: false,
    loadError: undefined,
    queryCursor: undefined,
    accountId: null,
    taggingPolicy: null,
    mandatoryTagCount: 0,
    selectedEntityType: { id: 'all', name: "All Entity Types", value: "ALL_ENTITIES" },
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

  onChangeTab = newTab => {
    nerdlet.setUrlState({ tab: newTab });
  };

  updateSelectedEntityType = entityType => {
    const { selectedEntityType, tagHierarchy, loadedEntities, entityTypesMap, entityTypesEntityCount } = this.state;
    
    this.setState({ 
      selectedEntityType: entityType,
      activeTagHierarchy: entityType.id === "all" 
        ? tagHierarchy 
        : entityTypesMap[entityType.value] ? entityTypesMap[entityType.value] : {},
      entityCount: entityType.id === "all" ? loadedEntities : entityTypesEntityCount[entityType]
    });
  }

  render() {
    const {
      doneLoading,
      entityCount,
      loadedEntities,
      tagHierarchy,
      activeTagHierarchy,
      entityTagsMap,
      entityTypesMap,
      entityTypesEntityCount,
      taggingPolicy,
      accountId,
      selectedEntityType
    } = this.state;

    const entityTypes = [
      { id: "all", name: "All Entity Types", value: "ALL_ENTITIES" },
      { id: "apm", name: "Application", value: "APM_APPLICATION_ENTITY" },
      { id: "browser", name: "Browser", value: "BROWSER_APPLICATION_ENTITY" },
      { id: "mobile", name: "Mobile", value: "MOBILE_APPLICATION_ENTITY" },
      { id: "infra", name: "Infrastructure", value: "INFRASTRUCTURE_HOST_ENTITY" },
      { id: "synth", name: "Synthetic", value: "SYNTHETIC_MONITOR_ENTITY" },
      { id: "dashboard", name: "Dashboard", value: "DASHBOARD_ENTITY" },
      { id: "workload", name: "Workload", value: "WORKLOAD_ENTITY" }
    ];

    return (
      <>
      <NerdletStateContext.Consumer>
        {nerdletState => (
          <>
          <div className="status" style={{height: "24px", lineHeight: "24px", paddingBottom: "9px"}}>
            Entity type:
            <Dropdown style={{marginLeft: "0"}}
              title={selectedEntityType.name}
              items={entityTypes}
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
                  entityCount={selectedEntityType.id === "all" ? entityCount : entityTypesEntityCount[selectedEntityType.value]}
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
                  entityCount={selectedEntityType.id === "all" ? entityCount : entityTypesEntityCount[selectedEntityType.value]}
                  loadedEntities={loadedEntities}
                  doneLoading={doneLoading}
                  height={this.props.height}
                />
              </TabsItem>
              <TabsItem value="entity-tab" label="Entities">
                <TagEntityView
                  tagHierarchy={activeTagHierarchy}
                  selectedEntityType={selectedEntityType}
                  entityCount={selectedEntityType.id === "all" ? entityCount : entityTypesEntityCount[selectedEntityType.value]}
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
        loadError: undefined,
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
      state: { queryCursor, accountId }
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
      queryString: `domain in ('APM', 'MOBILE', 'BROWSER')${
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
      .then(({ loading, data, errors }) => {
        if (data) {
          processEntityQueryResults(
            data.actor.entitySearch.results.entities,
            data.actor.entitySearch.count,
            data.actor.entitySearch.results.nextCursor
          );
        } else {
          console.log('data is NOT truthy', data);
        }
        if (errors) {
          console.log('Entity query error', errors);
        }
      })
      .catch(err => {
        this.setState({ loadError: err.toString() });
      });
  };

  // TODO: Need state overhaul to handle removing tags properly, and update entity view state correctly
  reloadEntities = entities => {
    const {
      processEntityQueryResults,
      state: { queryCursor, accountId }
    } = this;

    if (entities.length > 200) {
      this.startLoadingEntityTags();
      return;
    }

    const query = `
    query EntitiesReloadQuery($entities: [EntityGuid!]!) {
      actor {
        entities(guids: $entities) {
          name
          entityType
          guid
          accountId
          tags {
            tagKey: key
            tagValues: values
          }
        }
      }
    }
    `;
    const variables = {
      entities
    };

    this.setState({ doneLoading: false });
    NerdGraphQuery.query({
      query,
      variables
    })
      .then(({ loading, data, errors }) => {
        if (data) {
          processEntityQueryResults(
            data.actor.entities,
            data.actor.entities.length
          );
          this.setState({ doneLoading: true });
        } else {
          console.log('data is NOT truthy', data);
          this.setState({ doneLoading: true });
        }
        if (errors) {
          console.log('Entity query error', errors);
          this.setState({ doneLoading: true });
        }
      })
      .catch(err => {
        this.setState({ loadError: err.toString(), doneLoading: true });
      });
  };

  processEntityQueryResults = (entitiesToProcess, count, ngCursor) => {
    const {
      loadEntityBatch,
      setState,
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
      console.log('Error parsing results', err);
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
        else {
          this.setState({activeTagHierarchy: tagHierarchy});
        }
      }
    );
  };

  processLoadedEntityTags = entities => {
    const { tagHierarchy, entityTagsMap, taggingPolicy, mandatoryTagCount, entityTypesMap, entityTypesEntityCount } = this.state;
    entities.reduce((acc, entity) => {
      // get all the tags
      const { guid, tags, entityType } = entity;
      entityTagsMap[guid] = [...tags];
      
      this.updateEntityTagCompliance(entity, taggingPolicy, mandatoryTagCount);
      
      if (!entityTypesMap[entityType]) entityTypesMap[entityType] = [];
      if (!entityTypesEntityCount[entityType]) entityTypesEntityCount[entityType] = 0;

      // for each tag, if it doesn't make an empty object
      tags.forEach(({ tagKey, tagValues }) => {
        if (!acc[tagKey]) acc[tagKey] = {};
        if (!entityTypesMap[entityType][tagKey]) entityTypesMap[entityType][tagKey] = {};
        // for each tag value, check if it exists, if it doesn't make it an empty object
        tagValues.forEach(value => {
          if (!acc[tagKey][value]) acc[tagKey][value] = [];
          if (!entityTypesMap[entityType][tagKey][value]) entityTypesMap[entityType][tagKey][value] = [];
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
    taggingPolicy.forEach(tagPolicy => {
      const found = entity.tags.find((tag) => tag.tagKey === tagPolicy.key);
      const entityTag = {
        tagKey: tagPolicy.key,
        tagValues: found ? found.tagValues : ['---'],
      }

      if (tagPolicy.enforcement === 'required') {
        entity.mandatoryTags.push(entityTag);
        if (found) compliance += 1;
      } else if (tagPolicy.enforcement === 'optional') {
        entity.optionalTags.push(entityTag);
      }
    });
    entity.complianceScore = compliance ? (compliance / mandatoryTagCount) * 100 : 0;
  }

  getTaggingPolicy = () => {
    this.setState({ loadingPolicy: true });
    UserStorageQuery.query({
      collection: 'nr1-tag-improver',
      documentId: 'tagging-policy'
    })
      .then(({ data }) => {
        this.setState({
          taggingPolicy: sortedPolicy(data.policy),
          mandatoryTagCount: data.policy.filter(tag => tag.enforcement === 'required').length || 0,
          loadingPolicy: false,
          policyLoadErrored: false
        });
      })
      .catch(error => {
        this.setState({
          taggingPolicy: sortedPolicy(SCHEMA),
          mandatoryTagCount: SCHEMA.filter(tag => tag.enforcement === 'required').length || 0,
          loadingPolicy: false,
          policyLoadErrored: true
        });
      });
  };

  updatePolicy = policy => {
    this.setState({
      taggingPolicy: sortedPolicy(policy),
      mandatoryTagCount: policy.filter(tag => tag.enforcement === 'required').length || 0,
    });
  };
}

function sortedPolicy(policy) {
  const p = policy && policy.length > 0 ? policy : SCHEMA;
  return p.sort((a, b) => {
    const pa = ENFORCEMENT_PRIORITY[a.enforcement] || 99;
    const pb = ENFORCEMENT_PRIORITY[b.enforcement] || 99;
    return pa < pb
      ? 1
      : pa > pb
      ? -1
      : a.key.localeCompare(b.key, undefined, { sensitivity: 'base' });
  });
}

function tagsObject(policy) {
  return (policy || []).reduce(
    (acc, cur) => Object.assign(acc, acc[cur.enforcement].push(cur.key)),
    { required: [], optional: [] }
  );
}
