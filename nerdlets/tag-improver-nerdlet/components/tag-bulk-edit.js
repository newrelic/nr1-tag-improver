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

export default class TagBulkEdit extends React.Component {
  static propTypes = {
    selectedEntityIds: PropTypes.array,
    tagHierarchy: PropTypes.object,
    entityTagsMap: PropTypes.object,
    reloadTagsFn: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      selectedCurrentTag: '',
      selectedCurrentTagValue: '',
      selectedNewTagValue: '',
      entityStatuses: {},
    };
  }

  static contextType = PlatformStateContext;

  applyChangeValueToEntities = async () => {
    const { selectedEntityIds, entityTagsMap } = this.props;
    const {
      selectedCurrentTag,
      selectedCurrentTagValue,
      selectedNewTagValue,
      entityStatuses,
    } = this.state;
    const addMutation = `mutation($entityGuid: EntityGuid!, $entityTags: [TaggingTagInput!]!) {
      taggingAddTagsToEntity(guid: $entityGuid, tags: $entityTags) {
        errors {
            message
        }
      }
    }`;
    const deleteMutation = `mutation($entityGuid: EntityGuid!, $entityTags: [TaggingTagValueInput!]!) {
      taggingDeleteTagValuesFromEntity(
          guid: $entityGuid,
          tagValues: $entityTags) {
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
    entitiesToUpdate.forEach(entityId => {
      if (!statusObject[entityId]) {
        statusObject[entityId] = ENTITY_UPDATE_STATUS.ADDING;
      }
    });
    this.setState({ entityStatuses: statusObject });
    await entitiesToUpdate.map(async entityId => {
      let addSuccess = false;
      if (statusObject[entityId] < ENTITY_UPDATE_STATUS.REMOVING) {
        try {
          const tagsVariable = {
            key: selectedCurrentTag,
            values: [selectedNewTagValue],
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
          const tagsToDeleteForEntity = selectedCurrentTagValue
            ? [{ key: selectedCurrentTag, value: selectedCurrentTagValue }]
            : (
                (
                  entityTagsMap[entityId].find(
                    tag => tag.tagKey === selectedCurrentTag
                  ) || {}
                ).tagValues || []
              )
                .filter(tagValue => tagValue !== selectedNewTagValue)
                .map(tagValue => ({
                  key: selectedCurrentTag,
                  value: tagValue,
                }));
          if (tagsToDeleteForEntity.length) {
            const deleteVariables = {
              entityGuid: entityId,
              entityTags: tagsToDeleteForEntity,
            };
            const result = await NerdGraphMutation.mutate({
              mutation: deleteMutation,
              variables: deleteVariables,
            });
            if (result.error?.graphQLErrors.length) {
              throw result.error.graphQLErrors;
            } else if (
              result.data?.taggingDeleteTagValuesFromEntity?.errors?.length
            ) {
              throw result.data.taggingDeleteTagValuesFromEntity.errors;
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
                      status => status === ENTITY_UPDATE_STATUS.SUCCESS
                    )
                  ) {
                    this.props.reloadTagsFn(selectedEntityIds);
                  }
                }
              );
            }
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
  changeCurrentTagValue = (e, value) =>
    this.setState({ selectedCurrentTagValue: value });

  changeNewTagValue = (e, value) =>
    this.setState({ selectedNewTagValue: value });

  render() {
    const { selectedEntityIds, tagHierarchy, entityTagsMap } = this.props;
    const {
      entityStatuses,
      selectedCurrentTag,
      selectedCurrentTagValue,
      selectedNewTagValue,
    } = this.state;
    const tagsOnEntities = Array.from(
      selectedEntityIds.reduce((accumulator, entityGuid) => {
        (entityTagsMap[entityGuid] || []).forEach(tag =>
          accumulator.add(tag.tagKey)
        );
        return accumulator;
      }, new Set())
    ).sort((a, b) => (a.toUpperCase() > b.toUpperCase() ? 1 : -1));
    const currentValuesForTag = selectedCurrentTag
      ? Object.entries(tagHierarchy[selectedCurrentTag] || {})
          .filter(([, entities]) =>
            entities.some(entity => selectedEntityIds.includes(entity.guid))
          )
          .map(([tagKey]) => tagKey)
      : [];
    const tagValueSuggestions = selectedCurrentTag
      ? Object.keys(tagHierarchy[selectedCurrentTag] || {}).reduce(
          (accumulator, tagValue) => (
            (accumulator[tagValue] = tagValue),
            accumulator // eslint-disable-line no-sequences, prettier/prettier
          ),
          {}
        )
      : {};
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
      resultText = 'Change value';
    }

    return (
      <div className="full-height-modal">
        <div>
          <HeadingText type={HeadingText.TYPE.HEADING_1}>
            Change value
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
            {tagsOnEntities.map(tag => {
              return (
                <SelectItem key={`current-tag-select-${tag}`} value={tag}>
                  {tag}
                </SelectItem>
              );
            })}
          </Select>
          <div style={{ margin: '8px 8px 8px 0' }}>Select existing value</div>
          <Select
            className="full-width-select"
            value={selectedCurrentTagValue}
            onChange={this.changeCurrentTagValue}
            disabled={!selectedCurrentTag}
          >
            <SelectItem value="">All values</SelectItem>
            {currentValuesForTag.map(tag => {
              return (
                <SelectItem key={`current-tag-value-select-${tag}`} value={tag}>
                  {tag}
                </SelectItem>
              );
            })}
          </Select>
          <div style={{ margin: '8px 8px 8px 0' }}>Enter a new value</div>
          <div>
            <div className="add-tag-row">
              <Autocomplete
                style={{ width: '100%' }}
                choices={tagValueSuggestions}
                onChange={this.changeNewTagValue}
                placeholder="Replace with"
                value={selectedNewTagValue}
              />
            </div>
          </div>
        </div>
        <div>
          <div>
            {!!addSuccessEntities.length && (
              <div>
                Add replacement value succeeded for {addSuccessEntities.length}{' '}
                entities
              </div>
            )}
            {!!deleteSuccessEntities.length && (
              <div>
                Remove old value succeeded for {deleteSuccessEntities.length}{' '}
                entities
              </div>
            )}
            {!!addErrorEntities.length && (
              <div>
                Add replacement value failed for {addErrorEntities.length}{' '}
                entities
              </div>
            )}
            {!!deleteErrorEntities.length && (
              <div>
                Remove old value failed for {deleteErrorEntities.length}{' '}
                entities
              </div>
            )}
          </div>
          <div className="button-section">
            <Button
              type={Button.TYPE.PRIMARY}
              onClick={this.applyChangeValueToEntities}
              loading={!!loadingEntities.length}
              disabled={
                !selectedCurrentTag ||
                !selectedNewTagValue ||
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
