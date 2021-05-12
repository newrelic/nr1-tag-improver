import PromisePool from 'es6-promise-pool';
import { NerdGraphMutation, NerdGraphQuery, logger } from 'nr1';
import { isEqual } from 'lodash';

function createAddEntityTagGQL({ entitiesToUpdate, tagsToAdd }) {
  const tagsForGql = Object.entries(tagsToAdd).map(([tagKey, tagValue]) => ({
    key: tagKey,
    values: [tagValue]
  }));
  const mutation = `mutation($entityGuid: EntityGuid!, $entityTags: [TaggingTagInput!]!) {
    taggingAddTagsToEntity(guid: $entityGuid, tags: $entityTags) {
      errors {
          message
      }
    }
  }`;
  return entitiesToUpdate.map(entityGuid => {
    return {
      mutation,
      variables: {
        entityGuid,
        entityTags: tagsForGql
      }
    };
  });

}

function createDeleteEntityTagGQL({ entitiesToUpdate, tagsToDelete }) {
  const tagsForGql = Object.keys(tagsToDelete);
  const mutation = `mutation($entityGuid: EntityGuid!, $entityTags: [String!]!) {
    taggingDeleteTagFromEntity(
        guid: $entityGuid,
        tagKeys: $entityTags) {
            errors {
                message
            }
        }
  }`;
  return  entitiesToUpdate.map(entityGuid => {
    return {
      mutation,
      variables: {
        entityGuid,
        entityTags: tagsForGql
      }
    };
  });
}

function createAddEntityTagValuesGQL({
  entitiesToUpdate,
  entityTagsMap,
  newTagKey,
  currentTagKey
}) {
  const mutation = `mutation($entityGuid: EntityGuid!, $entityTags: [TaggingTagInput!]!) {
    taggingAddTagsToEntity(guid: $entityGuid, tags: $entityTags) {
      errors {
          message
      }
    }
  }`;

  return entitiesToUpdate.map(entityGuid => {
    const entityTags = entityTagsMap[entityGuid].reduce((_acc, _curr) => {
      if (_curr.tagKey === currentTagKey) {
        _acc.push({ key: newTagKey, values: _curr.tagValues });
      }
      return _acc;
    }, []);

    return {
      mutation,
      variables: {
        entityGuid,
        entityTags
      }
    };
  });
}

function createDeleteEntityTagValuesGQL({
  updatedEntityIds,
  entityTagsMap,
  tagKey,
  tagValue,
  newTagValue
}) {
  const mutation = `mutation($entityGuid: EntityGuid!, $entityTags: [TaggingTagValueInput!]!) {
    taggingDeleteTagValuesFromEntity(
        guid: $entityGuid,
        tagValues: $entityTags) {
            errors {
                message
            }
        }
  }`;

  return updatedEntityIds.map(entityGuid => {
    const tagsToDeleteForEntity = tagValue
      ? [{ key: tagKey, value: tagValue }]
      : (
          (entityTagsMap[entityGuid].find(tag => tag.tagKey === tagKey) || {})
            .tagValues || []
        )
          .filter(value => value !== newTagValue)
          .map(value => ({
            key: tagKey,
            value: value
          }));
    return {
      mutation,
      variables: {
        entityGuid,
        entityTags: tagsToDeleteForEntity
      }
    };
  });
}

async function executeGQL({ generatorFn, eventHandler, maxThreads = 3 }) {
  const pool = new PromisePool(generatorFn(), maxThreads);
  pool.addEventListener('fulfilled', eventHandler.passHandler);
  pool.addEventListener('rejected', eventHandler.failHandler);

  await pool.start();
}

export async function addTags({
  entitiesToUpdate,
  tagsToAdd,
  setEntityStatusFn,
  maxThreads = 3
}) {
  // Define the Promise pool event handler
  const eventHandler = (entityStatusUpdaterFn => {
    const failEntityIds = [];
    const passEntityIds = [];
    function handler({ data }) {
      const { error, result } = data;

      if (error && error.length > 0) {
        // eslint-disable-next-line prettier/prettier
        logger.error(`addTags() Critical error encoutered. ${error[0].message}`);
        throw new Error(error[0].message);
      }

      const { hasErrors, entityId } = result;
      const list = hasErrors ? failEntityIds : passEntityIds;
      list.push(entityId);
      entityStatusUpdaterFn(entityId, hasErrors);
    }
    return {
      entityStatusUpdaterFn,
      failEntityIds,
      passEntityIds,
      passHandler: handler,
      failHandler: handler
    };
  })(setEntityStatusFn);
  // Define the Promise generator
  const generatorFn = function*() {
    const statements = createAddEntityTagGQL({
      entitiesToUpdate,
      tagsToAdd
    });
    const execute = async function(statement) {
      const { entityGuid: entityId, entityTags: tags } = statement.variables; // eslint-disable-line prettier/prettier
      const response = await NerdGraphMutation.mutate(statement);
      const { errors } = response.data.taggingAddTagsToEntity;
      return {
        hasErrors: errors && errors.length > 0,
        errors,
        entityId,
        tags
      };
    };

    for (const statement of statements) {
      yield execute(statement);
    }
  };
  // execute the GQL statement(s)
  await executeGQL({
    generatorFn,
    eventHandler,
    maxThreads
  });

  // cleanup data model
  delete eventHandler.entityStatusUpdaterFn;
  delete eventHandler.passHandler;
  delete eventHandler.failHandler;
  // return list of pass/fail entity ids
  return { ...eventHandler };
}

export async function getEntities(entityIds, cursor = null) {
  const gql = {
    query: `query ($guids: [EntityGuid]!) {
              actor {
                entities(guids: $guids) {
                  ... on Entity {
                    guid
                    name
                    accountId
                    entityType
                    tags {
                      tagKey: key
                      tagValues: values
                    }
                  }
                }
              }
            }`,
    variables: { guids: entityIds, cursor },
    fetchPolicyType: NerdGraphQuery.FETCH_POLICY_TYPE.NO_CACHE
  };

  const response = await NerdGraphQuery.query(gql);

  const { data, errors } = response;
  if (errors) {
    const errMsg = errors[0].message;
    logger.error(
      `getEntities() error in retrieving entities. EntityIds=${entityIds} , cursor=${cursor}`
    );
    logger.error(`getEntities() error ${errMsg}}`);

    return {
      error: new Error(`${errMsg}`),
      entities: []
    };
  }

  let { entities, nextCursor } = data.actor;
  if (typeof entities === 'undefined') {
    entities = [];
  }

  if (nextCursor != null && nextCursor.length > 0) {
    const { entities: result_entities } = getEntities(entityIds, nextCursor);
    entities = entities.concat(result_entities);
  }
  return { error: null, entities };
}

export async function getAllEntities(
  accountId,
  selectedEntityTypeId,
  cursor = null
) {
  const gql = {
    query: `
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
    `,
    variables: {
      queryString: `domain = '${selectedEntityTypeId}' ${
        accountId && accountId !== 'cross-account'
          ? `AND accountId = '${accountId}'`
          : ''
      }`,
      nextCursor: cursor
    },
    fetchPolicyType: NerdGraphQuery.FETCH_POLICY_TYPE.NO_CACHE
  };

  return NerdGraphQuery.query(gql);
}

export async function deleteTags({
  entitiesToUpdate,
  tagsToDelete,
  setEntityStatusFn,
  maxThreads = 3
}) {
  // Define the Promise pool event handler
  const eventHandler = (entityStatusUpdaterFn => {
    const failEntityIds = [];
    const passEntityIds = [];
    function handler({ data }) {
      const { error, result } = data;

      if (error && error.length > 0) {
        // eslint-disable-next-line prettier/prettier
        logger.error(`deleteTags() Critical error encoutered. ${error[0].message}`);
        throw new Error(error[0].message);
      }

      const { errors, entityId } = result;
      const hasErrors = errors && errors.length > 1;
      const list = hasErrors ? failEntityIds : passEntityIds;
      list.push(entityId);
      entityStatusUpdaterFn(entityId, hasErrors);
    }
    return {
      entityStatusUpdaterFn,
      failEntityIds,
      passEntityIds,
      passHandler: handler,
      failHandler: handler
    };
  })(setEntityStatusFn);
  // Define the Promise generator
  const generatorFn = function*() {
    const statements = createDeleteEntityTagGQL({
      entitiesToUpdate,
      tagsToDelete
    });
    const execute = async function(statement) {
      const { entityGuid: entityId, entityTags: tags } = statement.variables; // eslint-disable-line prettier/prettier
      const response = await NerdGraphMutation.mutate(statement);
      const { errors } = response.data.taggingDeleteTagFromEntity;
      return {
        hasErrors: errors && errors.length > 0,
        errors,
        entityId,
        tags
      };
    };

    for (const statement of statements) {
      yield execute(statement);
    }
  };
  // execute the GQL statement(s)
  await executeGQL({
    generatorFn,
    eventHandler,
    maxThreads
  });

  // cleanup data model
  delete eventHandler.entityStatusUpdaterFn;
  delete eventHandler.passHandler;
  delete eventHandler.failHandler;
  // return list of pass/fail entity ids
  return { ...eventHandler };
}

export async function addTagAndValues({
  entitiesToUpdate,
  entityTagsMap,
  newTagKey,
  currentTagKey,
  setEntityStatusFn,
  maxThreads = 3
}) {
  // Define the Promise pool event handler
  const eventHandler = (entityStatusUpdaterFn => {
    const failEntityIds = [];
    const passEntityIds = [];
    function handler({ data }) {
      const { error, result } = data;

      if (error) {
        // eslint-disable-next-line prettier/prettier
        logger.error(`addTagAndValues() Critical error encoutered. ${error.message}`);
        throw new Error(error.message);
      }

      const { errors, entityId } = result;
      const hasErrors = errors && errors.length > 1;
      const list = hasErrors ? failEntityIds : passEntityIds;
      list.push(entityId);
      entityStatusUpdaterFn(entityId, hasErrors);
    }
    return {
      entityStatusUpdaterFn,
      failEntityIds,
      passEntityIds,
      passHandler: handler,
      failHandler: handler
    };
  })(setEntityStatusFn);
  // Define the Promise generator
  const generatorFn = function*() {
    const statements = createAddEntityTagValuesGQL({
      entitiesToUpdate,
      entityTagsMap,
      newTagKey,
      currentTagKey
    });
    const execute = async function(statement) {
      const { entityGuid: entityId, entityTags: tags } = statement.variables; // eslint-disable-line prettier/prettier
      const response = await NerdGraphMutation.mutate(statement);
      const { errors } = response.data.taggingAddTagsToEntity;
      return {
        hasErrors: errors && errors.length > 0,
        errors,
        entityId,
        tags
      };
    };

    for (const statement of statements) {
      yield execute(statement);
    }
  };
  // execute the GQL statement(s)
  await executeGQL({
    generatorFn,
    eventHandler,
    maxThreads
  });

  // cleanup data model
  delete eventHandler.entityStatusUpdaterFn;
  delete eventHandler.passHandler;
  delete eventHandler.failHandler;
  // return list of pass/fail entity ids
  return { ...eventHandler };
}
export async function deleteTagValues({
  updatedEntityIds,
  entityTagsMap,
  tagKey,
  tagValue,
  newTagValue,
  setEntityStatusFn,
  maxThreads = 3
}) {
  // Define the Promise pool event handler
  const eventHandler = (entityStatusUpdaterFn => {
    const failEntityIds = [];
    const passEntityIds = [];
    function handler({ data }) {
      const { error, result } = data;

      if (error && error.length > 0) {
        // eslint-disable-next-line prettier/prettier
        logger.error(`deleteTagValues() Critical error encoutered. ${error[0].message}`);
        throw new Error(error[0].message);
      }

      const { errors, entityId } = result;
      const hasErrors = errors && errors.length > 1;
      const list = hasErrors ? failEntityIds : passEntityIds;
      list.push(entityId);
      entityStatusUpdaterFn(entityId, hasErrors);
    }
    return {
      entityStatusUpdaterFn,
      failEntityIds,
      passEntityIds,
      passHandler: handler,
      failHandler: handler
    };
  })(setEntityStatusFn);
  // Define the Promise generator
  const generatorFn = function*() {
    const statements = createDeleteEntityTagValuesGQL({
      updatedEntityIds,
      entityTagsMap,
      tagKey,
      tagValue,
      newTagValue
    });
    const execute = async function(statement) {
      const { entityGuid: entityId, entityTags: tags } = statement.variables; // eslint-disable-line prettier/prettier
      const response = await NerdGraphMutation.mutate(statement);
      const { errors } = response.data.taggingDeleteTagValuesFromEntity;
      return {
        hasErrors: errors && errors.length > 0,
        errors,
        entityId,
        tags
      };
    };

    for (const statement of statements) {
      yield execute(statement);
    }
  };
  // execute the GQL statement(s)
  await executeGQL({
    generatorFn,
    eventHandler,
    maxThreads
  });

  // cleanup data model
  delete eventHandler.entityStatusUpdaterFn;
  delete eventHandler.passHandler;
  delete eventHandler.failHandler;
  // return list of pass/fail entity ids
  return { ...eventHandler };
}
export async function repeatIfEqual(
  before,
  retry_params,
  retryfn,
  count = 0,
  retries = 3,
  delay = 2e3
) {
  const after = await retryfn(retry_params);
  const hasChanged = !isEqual(before, after);

  if (count < retries && !hasChanged) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(repeatIfEqual(before, retry_params, retryfn, count + 1));
      }, delay);
    });
  }
  return Promise.resolve(hasChanged);
}
