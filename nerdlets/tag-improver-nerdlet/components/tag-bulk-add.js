import React from 'react';
import PropTypes from 'prop-types';

import {
  HeadingText,
  PlatformStateContext,
  Button,
  NerdGraphMutation,
} from 'nr1';
import Autocomplete from './autocomplete';

const emptyTagPlaceholderKey = '🏷️helloIAmTag';

const ENTITY_UPDATE_STATUS = {
  NONE: 0,
  UPDATING: 1,
  SUCCESS: 2,
  ERROR: 3,
};

export default class TagBulkAdd extends React.Component {
  static propTypes = {
    selectedEntityIds: PropTypes.array,
    tagHierarchy: PropTypes.object,
    reloadTagsFn: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      tagsToAdd: { [emptyTagPlaceholderKey]: '' },
      entityStatuses: {},
    };
  }

  static contextType = PlatformStateContext;

  applyTagsToEntities = async () => {
    const { selectedEntityIds } = this.props;
    const { tagsToAdd, entityStatuses } = this.state;
    const tagsForGql = Object.entries(tagsToAdd).map(([tagKey, tagValue]) => ({
      key: tagKey,
      values: [tagValue],
    }));
    const mutation = `mutation($entityGuid: EntityGuid!, $entityTags: [TaggingTagInput!]!) {
      taggingAddTagsToEntity(guid: $entityGuid, tags: $entityTags) {
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
        statusObject[entityId] = ENTITY_UPDATE_STATUS.UPDATING;
      }
    });
    this.setState({ entityStatuses: statusObject });
    await entitiesToUpdate.map(async entityId => {
      const variables = { entityGuid: entityId, entityTags: tagsForGql };
      try {
        const result = await NerdGraphMutation.mutate({ mutation, variables });
        if (result.error?.graphQLErrors.length) {
          throw result.error.graphQLErrors;
        } else if (result.data?.taggingAddTagsToEntity?.errors?.length) {
          throw result.data.taggingAddTagsToEntity.errors;
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
      } catch (error) {
        const previousStatuses = this.state.entityStatuses;
        this.setState({
          entityStatuses: {
            ...previousStatuses,
            [entityId]: ENTITY_UPDATE_STATUS.ERROR,
          },
        });
      }
    });
  };

  changeTag = (fromTag, toTag) => {
    // eslint-disable-next-line react/no-access-state-in-setstate
    const newTags = { ...this.state.tagsToAdd };
    newTags[toTag] = newTags[fromTag] || '';
    delete newTags[fromTag];
    this.setState({ tagsToAdd: newTags });
  };

  removeTag = tag => {
    // eslint-disable-next-line react/no-access-state-in-setstate
    const newTags = { ...this.state.tagsToAdd };
    delete newTags[tag];
    this.setState({ tagsToAdd: newTags });
  };

  onChangeTagValue = (tag, tagValue) => {
    const { tagsToAdd } = this.state;
    this.setState({ tagsToAdd: { ...tagsToAdd, [tag]: tagValue } });
  };

  addNewTag = () => {
    const { tagsToAdd } = this.state;
    this.setState({
      tagsToAdd: { ...tagsToAdd, [emptyTagPlaceholderKey]: '' },
    });
  };

  render() {
    const { selectedEntityIds, tagHierarchy } = this.props;
    const { tagsToAdd, entityStatuses } = this.state;
    const currentTagList = Object.keys(tagsToAdd);
    const existingTags = Object.keys(tagHierarchy);
    const availableTagsList = existingTags
      .filter(tag => !currentTagList.includes(tag))
      .sort((a, b) => (a.toUpperCase() > b.toUpperCase() ? 1 : -1));
    const availableTagsDictionary = availableTagsList.reduce(
      (accumulator, tag) => ((accumulator[tag] = tag), accumulator), // eslint-disable-line no-sequences
      {}
    );
    const canAddNewTag =
      currentTagList.length < 10 &&
      !currentTagList.includes(emptyTagPlaceholderKey);
    const statusEntries = Object.entries(entityStatuses);
    const loadingEntities = statusEntries
      .filter(([, status]) => status === ENTITY_UPDATE_STATUS.UPDATING)
      .map(([entityId]) => entityId);
    const successEntities = statusEntries
      .filter(([, status]) => status === ENTITY_UPDATE_STATUS.SUCCESS)
      .map(([entityId]) => entityId);
    const errorEntities = statusEntries
      .filter(([, status]) => status === ENTITY_UPDATE_STATUS.ERROR)
      .map(([entityId]) => entityId);
    const allSucceeded = successEntities.length === selectedEntityIds.length;

    let resultText = '';
    if (errorEntities.length > 0) {
      resultText = 'Retry';
    } else if (allSucceeded) {
      resultText = 'Tags added!';
    } else {
      resultText = 'Add tags';
    }

    return (
      <div className="full-height-modal">
        <div>
          <HeadingText type={HeadingText.TYPE.HEADING_1}>Add tags</HeadingText>
          {Object.entries(tagsToAdd).map(([tagKey, tagValue], index) => {
            const isNewTag =
              !existingTags.includes(tagKey) &&
              tagKey !== emptyTagPlaceholderKey;
            return (
              <div key={`add-tag-row-${index}`}>
                <div className="add-tag-row">
                  <Autocomplete
                    className="add-tag-autocomplete"
                    choices={availableTagsDictionary}
                    onChange={(_, toTag) => this.changeTag(tagKey, toTag)}
                    placeholder="Tag"
                    value={tagKey === emptyTagPlaceholderKey ? '' : tagKey}
                  />

                  <Autocomplete
                    choices={Object.keys(tagHierarchy[tagKey] || {}).reduce(
                      (accumulator, tag) => (
                        (accumulator[tag] = tag),
                        accumulator // eslint-disable-line no-sequences, prettier/prettier
                      ),
                      {}
                    )}
                    onChange={(_, value) =>
                      this.onChangeTagValue(tagKey, value)
                    }
                    disabled={!tagKey || tagKey === emptyTagPlaceholderKey}
                    placeholder="Value"
                    value={tagValue}
                  />
                  {currentTagList.length > 1 ? (
                    <Button
                      iconType={
                        Button.ICON_TYPE
                          .INTERFACE__OPERATIONS__REMOVE__V_ALTERNATE
                      }
                      type={Button.TYPE.PLAIN}
                      onClick={() => this.removeTag(tagKey)}
                    />
                  ) : (
                    <div style={{ width: 32 }} />
                  )}
                </div>
                {isNewTag && <div className="tag-detail-label">New tag</div>}
              </div>
            );
          })}
          {canAddNewTag && (
            <div>
              <Button
                iconType={Button.ICON_TYPE.INTERFACE__SIGN__PLUS}
                type={Button.TYPE.PLAIN}
                onClick={this.addNewTag}
              >
                Add tag
              </Button>
            </div>
          )}
        </div>
        <div>
          <div>
            {!!successEntities.length && (
              <div>
                Add tags succeeded for {successEntities.length} entities
              </div>
            )}
            {!!errorEntities.length && (
              <div>Add tags failed for {errorEntities.length} entities</div>
            )}
          </div>
          <div className="button-section">
            <Button
              type={Button.TYPE.PRIMARY}
              disabled={
                currentTagList.every(tag => tag === emptyTagPlaceholderKey) ||
                loadingEntities.length > 0 ||
                allSucceeded
              }
              onClick={this.applyTagsToEntities}
              loading={loadingEntities.length > 0}
            >
              {resultText}
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
