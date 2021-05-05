import PromisePool from 'es6-promise-pool';

import { NerdGraphMutation } from 'nr1';

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
  const mutations = entitiesToUpdate.map(entityGuid => {
    //  entityStatus format is array [ <GUID>, <ENTITY_UPDATE_STATUS.SUCCESS> ]
    return {
      mutation,
      variables: {
        entityGuid,
        entityTags: tagsForGql
      }
    };
  });

  return mutations;
}

async function sendGQL({ graphStatements, eventHandlers, maxThreads = 3 }) {
  const mutationFnGenerator = function*({ statements }) {
    // console.log(`sendGQL statements=${JSON.stringify(statements)}`);
    for (let i = 0; i < statements.length; i++) {
      yield (async () => {
        const { entityGuid: entityId, entityTags: tags } = statements[i].variables; // eslint-disable-line prettier/prettier
        const response = await NerdGraphMutation.mutate(statements[i]);

        // TODO: refactor this .. pass response parser so it can be used by other actions
        const errors = response.data.taggingAddTagsToEntity.errors;

        const result = {
          hasErrors: errors.length > 0,
          errors,
          entity: {
            entityId,
            tags
          }
        };
        return Promise.resolve(result);
      })();
    }
  }; // eof mutationFnGenerator

  const pool = new PromisePool(
    mutationFnGenerator({ statements: graphStatements }),
    maxThreads
  );
  pool.addEventListener('fulfilled', eventHandlers.passHandler);
  pool.addEventListener('rejected', eventHandlers.failHandler);

  await pool.start();
}

export async function addTags({
  entitiesToUpdate,
  tagsToAdd,
  setEntityStatusFn,
  maxThreads = 3
}) {
  const graphStatements = createAddEntityTagGQL({
    entitiesToUpdate,
    tagsToAdd
  });

  const eventHandlers = (entityStatusUpdaterFn => {
    const errors = [];
    function handler({ data }) {
      const { errors: _errors, hasErrors, entity } = data.result;
      if (hasErrors) {
        errors.push({ errors: _errors, entity });
      }
      entityStatusUpdaterFn(entity.entityId, hasErrors);
    }
    return {
      entityStatusUpdaterFn,
      errors,
      passHandler: handler,
      failHandler: handler
    };
  })(setEntityStatusFn);

  await sendGQL({
    graphStatements,
    eventHandlers,
    maxThreads
  });
  return { errors: eventHandlers.errors, hasErrors: eventHandlers.hasErrors };
}
