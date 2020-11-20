import React from 'react';
import {
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
    entityTagsMap: {},
    entityCount: 0,
    loadedEntities: 0,
    doneLoading: false,
    loadError: undefined,
    queryCursor: undefined,
    accountId: null,
    taggingPolicy: null
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

  render() {
    const {
      doneLoading,
      entityCount,
      loadedEntities,
      tagHierarchy,
      entityTagsMap,
      taggingPolicy,
      accountId
    } = this.state;

    return (
      <NerdletStateContext.Consumer>
        {nerdletState => (
          <>
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
                  tagHierarchy={tagHierarchy}
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
                  entityCount={entityCount}
                  loadedEntities={loadedEntities}
                  doneLoading={doneLoading}
                />
              </TabsItem>
              <TabsItem value="entity-tab" label="Entities">
                <TagEntityView
                  tagHierarchy={tagHierarchy}
                  entityCount={entityCount}
                  loadedEntities={loadedEntities}
                  doneLoading={doneLoading}
                  entityTagsMap={entityTagsMap}
                  reloadTagsFn={this.startLoadingEntityTags}
                />
              </TabsItem>
            </Tabs>
          </>
        )}
      </NerdletStateContext.Consumer>
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
      }
    );
  };

  processLoadedEntityTags = entities => {
    const { tagHierarchy, entityTagsMap } = this.state;
    entities.reduce((acc, entity) => {
      // get all the tags
      const { guid, tags } = entity;
      entityTagsMap[guid] = [...tags];
      // for each tag, if it doesn't make an empty object
      tags.forEach(({ tagKey, tagValues }) => {
        if (!acc[tagKey]) acc[tagKey] = {};
        // for each tag value, check if it exists, if it doesn't make it an empty object
        tagValues.forEach(value => {
          if (!acc[tagKey][value]) acc[tagKey][value] = [];
          acc[tagKey][value].push(entity);
        });
      });
      return acc;
    }, tagHierarchy);

    return tagHierarchy;
  };

  getTaggingPolicy = () => {
    this.setState({ loadingPolicy: true });
    UserStorageQuery.query({
      collection: 'nr1-tag-improver',
      documentId: 'tagging-policy'
    })
      .then(({ data }) => {
        this.setState({
          taggingPolicy: sortedPolicy(data.policy),
          loadingPolicy: false,
          policyLoadErrored: false
        });
      })
      .catch(error => {
        this.setState({
          taggingPolicy: sortedPolicy(SCHEMA),
          loadingPolicy: false,
          policyLoadErrored: true
        });
      });
  };

  updatePolicy = policy => {
    this.setState({ taggingPolicy: sortedPolicy(policy) });
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
