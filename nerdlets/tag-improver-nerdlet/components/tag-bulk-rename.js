import React from 'react';
import PropTypes from 'prop-types';

import {
  HeadingText,
  PlatformStateContext,
  Button,
  NerdGraphMutation,
  Select,
  SelectItem,
} from 'nr1';
import Autocomplete from './autocomplete';

const ENTITY_UPDATE_STATUS = {
  NONE: 0,
  ADDING: 1,
  ADD_ERROR: 2,
  REMOVING: 3,
  REMOVE_ERROR: 4,
  SUCCESS: 5,
};

export default class TagBulkRename extends React.Component {
  static propTypes = {
    selectedEntityIds: PropTypes.array,
    tagHierarchy: PropTypes.object,
    entityTagsMap: PropTypes.object,
    reloadTagsFn: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      entityStatuses: {},
      selectedCurrentTag: '',
      selectedNewTag: '',
    };
  }

  static contextType = PlatformStateContext;

  applyRenameToEntities = async () => {
    const { selectedEntityIds, entityTagsMap } = this.props;
    const { selectedCurrentTag, selectedNewTag, entityStatuses } = this.state;
    const addMutation = `mutation($entityGuid: EntityGuid!, $entityTags: [TaggingTagInput!]!) {
      taggingAddTagsToEntity(guid: $entityGuid, tags: $entityTags) {
        errors {
            message
        }
      }
    }`;
    const deleteMutation = `mutation($entityGuid: EntityGuid!, $entityTags: [String!]!) {
      taggingDeleteTagFromEntity(
          guid: $entityGuid,
          tagKeys: $entityTags) {
              errors {
                  message
              }
          }
    }`;
    let entitiesToUpdate;
    const statusEntries = Object.entries(entityStatuses);
    if (statusEntries.length) {
      entitiesToUpdate = statusEntries.filter(
        ([, entityStatus]) => entityStatus !== ENTITY_UPDATE_STATUS.SUCCESS
      );
    } else {
      entitiesToUpdate = selectedEntityIds;
    }
    const statusObject = { ...entityStatuses };
    entitiesToUpdate.forEach((entityId) => {
      if (!statusObject[entityId]) {
        statusObject[entityId] = ENTITY_UPDATE_STATUS.ADDING;
      }
    });
    this.setState({ entityStatuses: statusObject });
    await selectedEntityIds.map(async (entityId) => {
      let addSuccess = false;
      if (statusObject[entityId] < ENTITY_UPDATE_STATUS.REMOVING) {
        try {
          const tagValuesForEntity = entityTagsMap[entityId].find(
            (tag) => tag.tagKey === selectedCurrentTag
          ).tagValues;
          const tagsVariable = {
            key: selectedNewTag,
            values: tagValuesForEntity,
          };
          const addVariables = {
            entityGuid: entityId,
            entityTags: tagsVariable,
          };
          const result = await NerdGraphMutation.mutate({
            mutation: addMutation,
            variables: addVariables,
          });
          if (result.error?.graphQLErrors.length) {
            throw result.error.graphQLErrors;
          } else if (result.data?.taggingAddTagsToEntity?.errors?.length) {
            throw result.data.taggingAddTagsToEntity.errors;
          } else {
            addSuccess = true;
            const previousStatuses = this.state.entityStatuses;
            this.setState({
              entityStatuses: {
                ...previousStatuses,
                [entityId]: ENTITY_UPDATE_STATUS.REMOVING,
              },
            });
          }
        } catch (error) {
          addSuccess = false;
          const previousStatuses = this.state.entityStatuses;
          this.setState({
            entityStatuses: {
              ...previousStatuses,
              [entityId]: ENTITY_UPDATE_STATUS.ADD_ERROR,
            },
          });
        }
      } else {
        addSuccess = true;
      }
      if (
        addSuccess &&
        this.state.entityStatuses[entityId] < ENTITY_UPDATE_STATUS.SUCCESS
      ) {
        try {
          const deleteVariables = {
            entityGuid: entityId,
            entityTags: [selectedCurrentTag],
          };
          const result = await NerdGraphMutation.mutate({
            mutation: deleteMutation,
            variables: deleteVariables,
          });
          if (result.error?.graphQLErrors.length) {
            throw result.error.graphQLErrors;
          } else if (result.data?.taggingDeleteTagFromEntity?.errors?.length) {
            throw result.data.taggingDeleteTagFromEntity.errors;
          } else {
            const previousStatuses = this.state.entityStatuses;
            this.setState(
              {
                entityStatuses: {
                  ...previousStatuses,
                  [entityId]: ENTITY_UPDATE_STATUS.SUCCESS,
                },
              },
              () => {
                if (
                  Object.values(this.state.entityStatuses).every(
                    (status) => status === ENTITY_UPDATE_STATUS.SUCCESS
                  )
                ) {
                  this.props.reloadTagsFn(selectedEntityIds);
                }
              }
            );
          }
        } catch (error) {
          addSuccess = false;
          const previousStatuses = this.state.entityStatuses;
          this.setState({
            entityStatuses: {
              ...previousStatuses,
              [entityId]: ENTITY_UPDATE_STATUS.REMOVE_ERROR,
            },
          });
        }
      }
    });
  };

  changeCurrentTag = (e, value) => this.setState({ selectedCurrentTag: value });
  changeNewTag = (e, value) => this.setState({ selectedNewTag: value });

  render() {
    const { selectedEntityIds, tagHierarchy, entityTagsMap } = this.props;
    const { entityStatuses, selectedCurrentTag, selectedNewTag } = this.state;
    const tagsOnEntities = Array.from(
      selectedEntityIds.reduce((accumulator, entityGuid) => {
        (entityTagsMap[entityGuid] || []).forEach((tag) =>
          accumulator.add(tag.tagKey)
        );
        return accumulator;
      }, new Set())
    ).sort((a, b) => (a.toUpperCase() > b.toUpperCase() ? 1 : -1));
    const existingTags = Object.keys(tagHierarchy);
    const availableTagsList = existingTags.sort((a, b) =>
      a.toUpperCase() > b.toUpperCase() ? 1 : -1
    );
    const availableTagsDictionary = availableTagsList.reduce(
      (accumulator, tag) => ((accumulator[tag] = tag), accumulator), // eslint-disable-line no-sequences
      {}
    );
    const isNewTag = selectedNewTag && !existingTags.includes(selectedNewTag);
    const statusEntries = Object.entries(entityStatuses);
    const loadingEntities = statusEntries
      .filter(([, status]) =>
        [ENTITY_UPDATE_STATUS.ADDING, ENTITY_UPDATE_STATUS.REMOVING].includes(
          status
        )
      )
      .map(([entityId]) => entityId);
    const addSuccessEntities = statusEntries
      .filter(([, status]) => status > ENTITY_UPDATE_STATUS.ADD_ERROR)
      .map(([entityId]) => entityId);
    const deleteSuccessEntities = statusEntries
      .filter(([, status]) => status === ENTITY_UPDATE_STATUS.SUCCESS)
      .map(([entityId]) => entityId);
    const addErrorEntities = statusEntries
      .filter(([, status]) => status === ENTITY_UPDATE_STATUS.ADD_ERROR)
      .map(([entityId]) => entityId);
    const deleteErrorEntities = statusEntries
      .filter(([, status]) => status === ENTITY_UPDATE_STATUS.REMOVE_ERROR)
      .map(([entityId]) => entityId);
    const allSucceeded =
      deleteSuccessEntities.length === selectedEntityIds.length;

    let resultText = '';
    if (!!addErrorEntities.length || !!deleteErrorEntities.length) {
      resultText = 'Retry';
    } else if (allSucceeded) {
      resultText = 'Tags changed!';
    } else {
      resultText = 'Rename tag';
    }

    return (
      <div className="full-height-modal">
        <div>
          <HeadingText type={HeadingText.TYPE.HEADING_1}>
            Rename tag
          </HeadingText>
          <div style={{ margin: '8px 8px 8px 0' }}>Select your tag</div>
          <Select
            className="full-width-select"
            value={selectedCurrentTag}
            onChange={this.changeCurrentTag}
          >
            <SelectItem disabled value="">
              Current tag
            </SelectItem>
            {tagsOnEntities.map((tag) => {
              return (
                <SelectItem key={`current-tag-select-${tag}`} value={tag}>
                  {tag}
                </SelectItem>
              );
            })}
          </Select>
          <div style={{ margin: '8px 8px 8px 0' }}>Enter a new tag key</div>
          <div>
            <div className="add-tag-row">
              <Autocomplete
                style={{ width: '100%' }}
                choices={availableTagsDictionary}
                onChange={this.changeNewTag}
                placeholder="Replace with"
                value={selectedNewTag}
              />
            </div>
            {isNewTag && <div className="tag-detail-label">New tag</div>}
          </div>
        </div>
        <div>
          <div>
            {!!addSuccessEntities.length && (
              <div>
                Add replacement tags succeeded for {addSuccessEntities.length}{' '}
                entities
              </div>
            )}
            {!!deleteSuccessEntities.length && (
              <div>
                Remove old tag succeeded for {deleteSuccessEntities.length}{' '}
                entities
              </div>
            )}
            {!!addErrorEntities.length && (
              <div>
                Add replacement tags failed for {addErrorEntities.length}{' '}
                entities
              </div>
            )}
            {!!deleteErrorEntities.length && (
              <div>
                Remove old tags failed for {deleteErrorEntities.length} entities
              </div>
            )}
          </div>
          <div className="button-section">
            <Button
              type={Button.TYPE.PRIMARY}
              onClick={this.applyRenameToEntities}
              loading={!!loadingEntities.length}
              disabled={
                !selectedCurrentTag ||
                !selectedNewTag ||
                !!loadingEntities.length ||
                allSucceeded
              }
            >
              {resultText}
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
