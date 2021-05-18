import PromisePool from 'es6-promise-pool';
import {
  NerdGraphMutation,
  NerdGraphQuery,
  UserStorageQuery,
  AccountStorageQuery,
  AccountStorageMutation,
  logger,
  Toast
} from 'nr1';
import { isEqual } from 'lodash';
import { SCHEMA, STORAGE_TYPE } from '../tag-schema';

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

export const TAG_POLICY_COLLECTION = {
  collection: 'nr1-tag-improver',
  documentId: 'tagging-policy'
};

export function showError(error) {
  if (!error && error.message.length === 0) {
    return;
  }

  Toast.showToast({
    title: 'Error',
    sticky: true,
    description: error.message,
    type: Toast.TYPE.CRITICAL
  });
  return { errorMessage: error.message, hasError: true };
}
export function showErrors(errors) {
  if (!errors || errors.length === 0) {
    return;
  }

  errors.forEach(error => {
    showError(error);
  });
}

function handleStorageQuery({ storageType, data }) {
  let result = {
    taggingPolicy: {},
    keyCount: 0,
    mandatoryTagCount: 0
  };
  let error = null;
  let hasError = false;
  try {
    if (data) {
      const keyCount = data.policy.length;
      const taggingPolicy = keyCount > 0 ? data.policy : {};
      if (keyCount > 0) {
        result = {
          taggingPolicy: taggingPolicy,
          keyCount,
          mandatoryTagCount:
            taggingPolicy.filter(tag => tag.enforcement === 'required')
              .length || 0
        };
      }
    }
  } catch (err) {
    hasError = true;
    error = err;
    console.log(`handleStorageQuery: Error=${error.message}`);
  }

  return { storageType, hasError, error, ...result };
}

export function mutateAccountStorage(mutation) {
  return AccountStorageMutation.mutate(mutation)
    .then(data => {
      return handleStorageQuery({
        storageType: 'account',
        hasError: false,
        policySaveErrored: false,
        data
      });
    })
    .catch(error => {
      console.log(error);
      return handleStorageQuery({
        storageType: 'account',
        hasError: true,
        policySaveErrored: true
      });
    });
}

export function hasAccountStorageWriteAccess({ accountId }) {
  if (!parseInt(accountId)) {
    return false;
  }

  const mutation = {
    accountId,
    collection: 'nr1-tag-improver',
    documentId: 'tagging-policy-write-test'
  };
  return AccountStorageMutation.mutate({
    ...mutation,
    actionType: AccountStorageMutation.ACTION_TYPE.WRITE_DOCUMENT,
    document: { text: 'hello world' }
  })
    .then(() => {
      // console.log(data.nerdStorageWriteDocument.text);
      return AccountStorageMutation.mutate({
        ...mutation,
        actionType: AccountStorageMutation.ACTION_TYPE.DELETE_DOCUMENT
      });
    })
    .then(() => {
      return true;
    })
    .catch(error => {
      console.log(error);
      return false;
    });
}

export function queryUserStorage() {
  return UserStorageQuery.query(TAG_POLICY_COLLECTION).then(({ data }) => {
    return handleStorageQuery({ storageType: 'user', data });
  });
}
export function queryAccountStorage({ accountId }) {
  return (_=> {
    if (!parseInt(accountId)) {
      return Promise.resolve({ data: null });
    } else {
      return AccountStorageQuery.query({ ...TAG_POLICY_COLLECTION, accountId });
    }
  })().then(({ data }) => {
    return handleStorageQuery({ storageType: 'account', data });
  });
}
export async function loadTaggingPolicy({ accountId }) {
  const errors = [];
  const results = await Promise.all(
    [queryUserStorage(), queryAccountStorage({ accountId })].map(p =>
      p.catch(error => {
        errors.push(error);
      })
    )
  );

  showErrors(errors);
  const response = {
    hasAccountPolicy: false,
    hasUserPolicy: false,
    userPolicy: {},
    accountPolicy: {}
  };
  const userPolicy = results
    .filter(({ hasError }) => !hasError)
    .filter(({ storageType }) => storageType === 'user');
  const accountPolicy = results
    .filter(({ hasError }) => !hasError)
    .filter(({ storageType }) => storageType === 'account');

  if (accountPolicy && accountPolicy.length > 0) {
    response.hasAccountPolicy = accountPolicy[0].keyCount > 0;
    response.accountPolicy =
      accountPolicy[0].keyCount > 0 ? { ...accountPolicy[0] } : {};
  }
  if (userPolicy && userPolicy.length > 0) {
    response.hasUserPolicy = userPolicy[0].keyCount > 0;
    response.userPolicy =
      userPolicy[0].keyCount > 0 ? { ...userPolicy[0] } : {};
  }

  return response;
}

export async function getTaggingPolicyProps(storageId, accountId) {
  const {
    hasAccountPolicy,
    hasUserPolicy,
    accountPolicy,
    userPolicy
  } = await loadTaggingPolicy({ accountId });
  let taggingPolicy = SCHEMA;

  const storageTypes = [];
  const [USER_STORE, ACCOUNT_STORE] = STORAGE_TYPE;

  if (hasUserPolicy) {
    storageTypes.push(STORAGE_TYPE[0]);
  }

  if (hasAccountPolicy) {
    storageTypes.push(STORAGE_TYPE[1]);
  }

  if (storageId === 'SCHEMA') {
    taggingPolicy = hasUserPolicy ? [...userPolicy.taggingPolicy] : SCHEMA;
    storageId = hasUserPolicy ? USER_STORE.id : storageId;
  }

  if (storageId === USER_STORE.id && hasUserPolicy) {
    taggingPolicy = [...userPolicy.taggingPolicy];
  } else if (storageId === ACCOUNT_STORE.id && hasAccountPolicy) {
    taggingPolicy = [...accountPolicy.taggingPolicy];
  }

  return { taggingPolicy, storageTypes, storageId };
}



