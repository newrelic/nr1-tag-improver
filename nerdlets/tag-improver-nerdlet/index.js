import React from 'react';
import PropTypes from 'prop-types';

import {
  Dropdown,
  DropdownItem,
  Spinner,
  Tabs,
  TabsItem,
  nerdlet,
  PlatformStateContext,
  NerdletStateContext,
  UserStorageQuery
} from 'nr1';

import {
  SCHEMA,
  ENFORCEMENT_PRIORITY,
  ENTITY_TYPES,
  STORAGE_TYPE
} from './tag-schema';

import { StorageTypeView } from './components/tag-schema-store';
import TagCoverageView from './components/tag-coverage';
import TagEntityView from './components/tag-entity-view';
import TaggingPolicy from './components/tag-policy';
import { getAllEntities, getEntities, getTaggingPolicyProps } from './components/commonUtils';

export default class TagVisualizer extends React.Component {
  static propTypes = {
    height: PropTypes.number
  };

  state = {
    entities: [],
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
    selectedStorageId: 'SCHEMA',
    selectedTagKey: '',
    selectedTagValue: '',
    currentTab: 'policy-tab'
  };

  componentDidMount() {
    nerdlet.setConfig({
      timePicker: false,
      accountPicker: true,
      selectedStorageId: 'SCHEMA',
      accountPickerValues: [
        nerdlet.ACCOUNT_PICKER_VALUE.CROSS_ACCOUNT,
        ...nerdlet.ACCOUNT_PICKER_DEFAULT_VALUES
      ]
    });
    this.setState(
      { accountId: this.context.accountId, entities: [] },
      async () => {
        await this.getTaggingPolicy();
        this.startLoadingEntityTags();
      }
    );
  }

  componentDidUpdate() {
    if (this.context.accountId !== this.state.accountId) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ accountId: this.context.accountId }, async () => {
        await this.getTaggingPolicy();
        this.startLoadingEntityTags();
      });
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
  startLoadingEntityTags = async (selectedIds = null) => {

    const defaults = {
      entities: [],
      entityCount: 0,
      loadedEntities: 0,
      doneLoading: false,
      queryCursor: undefined,
      selectedTagKey: '',
      selectedTagValue: ''
    };

    let attrs = { ...defaults };
    if (!selectedIds) {
      attrs = { ...attrs, tagHierarchy: {}, entityTagsMap: {} };
    }

    this.setState(attrs);
    return new Promise(resolve => {
      return resolve(this.loadEntityBatch(selectedIds));
    });
  };

  loadEntityBatch = async (selectedIds = null) => {
    const {
      processEntityQueryResults,
      state: { queryCursor, accountId, selectedEntityType }
    } = this;
    let packedData = {};
    if (selectedIds) {
      const { entities } = await getEntities(selectedIds);
      packedData = {
        entities,
        count: entities && entities.length > 0 ? entities.length : 0,
        cursor: null
      };
    } else {
      const { data } = await getAllEntities(
        accountId,
        selectedEntityType.id,
        queryCursor
      );
      packedData = {
        entities: data.actor.entitySearch.results.entities,
        count: data.actor.entitySearch.count,
        cursor: data.actor.entitySearch.results.nextCursor
      };
    }
    return processEntityQueryResults(
      packedData.entities,
      packedData.count,
      packedData.cursor,
      selectedIds
    );
  };

  processEntityQueryResults = (
    entities = [],
    count = 0,
    cursor = null,
    selectedIds = null
  ) => {
    const {
      loadEntityBatch,
      state: { loadedEntities, accountId }
    } = this;
    const { entities: state_entities } = this.state;
    if (accountId !== this.state.accountId) {
      return;
    }

    const {
      tagHierarchy,
      entityTagsMap,
      taggingPolicy
    } = this.processLoadedEntityTags(entities);
    const updatedEntities = state_entities.concat(entities);
    this.setState(
      {
        entities: updatedEntities,
        tagHierarchy,
        entityTagsMap,
        taggingPolicy,
        queryCursor: cursor,
        entityCount: count,
        loadedEntities: loadedEntities + entities.length,
        doneLoading: !cursor
      },
      async () => {
        if (cursor && accountId === this.state.accountId) {
          await loadEntityBatch(selectedIds);
        }
      }
    );
  };

  processLoadedEntityTags = entities => {
    const tagHierarchy =
      this.state.tagHierarchy && Object.keys(this.state.tagHierarchy).length > 0
        ? { ...this.state.tagHierarchy }
        : {};
    const entityTagsMap =
      this.state.entityTagsMap &&
      Object.keys(this.state.entityTagsMap).length > 0
        ? { ...this.state.entityTagsMap }
        : {};
    const taggingPolicy =
      this.state.taggingPolicy && this.state.taggingPolicy.length > 0
        ? [...this.state.taggingPolicy]
        : [];

    const { mandatoryTagCount } = this.state;

    if (!Object.keys(tagHierarchy).length) {
      for (const tag of taggingPolicy) {
        tagHierarchy[tag.key] = {};
      }
    }

    entities.reduce((acc, entity) => {
      // get all the tags
      if (entity.__typename) {
        delete entity.__typename;
      }

      const { guid, tags } = entity;
      entityTagsMap[guid] = tags.map(tag => {
        if (tag.__typename) {
          delete tag.__typename;
        }
        return tag;
      });

      this.updateEntityTagCompliance(entity, taggingPolicy, mandatoryTagCount);

      const newKeys = [];
      for (const { tagKey: key, tagValues: values } of tags) {
        newKeys.push(key);

        if (!acc[key]) {
          acc[key] = {};
        } else {
          // dedup by removing existing/matching entity
          // assumption: entities includes the latest values
          acc[key] = Object.keys(acc[key]).map(_values =>
            acc[key][_values].filter(_entity => _entity.guid !== guid)
          );
        }

        for (const value of values) {
          if (!acc[key][value] || key.toLowerCase() === 'guid') {
            acc[key][value] = [];
          }

          acc[key][value].push(entity);
        } // end of for-loop values
      } // end of for-loop tags

      // find stale keys
      const removedKeys =
        Object.keys(tagHierarchy).length > 0
          ? Object.keys(tagHierarchy).filter(key => !newKeys.includes(key))
          : [];

      // remove stale data
      removedKeys.forEach(removedKey => {
        Object.keys(acc[removedKey]).forEach(value => {
          acc[removedKey][value] = acc[removedKey][value].filter(
            e => e.guid !== entity.guid
          );
        });
      });

      return acc;
    }, tagHierarchy); // end of reducer

    return { tagHierarchy, entityTagsMap, taggingPolicy };
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

  getTaggingPolicy = async () => {
    const { taggingPolicy, storageId } = await getTaggingPolicyProps(
      this.state.storageId || 'SCHEMA',
      this.state.accountId
    );
    this.setState({
      storageId,
      taggingPolicy: sortedPolicy(taggingPolicy),
      mandatoryTagCount:
        taggingPolicy.filter(tag => tag.enforcement === 'required').length || 0
    });
  };

  updatePolicy = (policy, prevPolicy) => {
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

    this.setState({
      taggingPolicy: sortedPolicy(policy),
      mandatoryTagCount:
        policy.filter(tag => tag.enforcement === 'required').length || 0
    });
  };

  setTaggingPolicy = (taggingPolicy, storageId) => {
    this.setState(
      { tagHierarchy: {}, taggingPolicy, selectedStorageId: storageId },
      () => {
        if (this.state.entities != null) {
          const {
            tagHierarchy,
            entityTagsMap,
            taggingPolicy
          } = this.processLoadedEntityTags(this.state.entities);
          this.setState({
            tagHierarchy,
            entityTagsMap,
            taggingPolicy
          });
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
      selectedStorageId,
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
                <StorageTypeView
                  accountId={accountId}
                  selectedStorageId={selectedStorageId}
                  setTaggingPolicy={this.setTaggingPolicy}
                />

                 Entity type:
                <Dropdown
                  style={{ marginLeft: '0'}}
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
                    selectedStorageId={selectedStorageId}
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

