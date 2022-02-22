import React from 'react';
import PropTypes from 'prop-types';

import {
  HeadingText,
  PlatformStateContext,
  BlockText,
  Button,
  NerdGraphMutation,
  Select,
  SelectItem
} from 'nr1';

const emptyTagPlaceholderKey = '🏷️helloIAmTag';

const ENTITY_UPDATE_STATUS = {
  NONE: 0,
  UPDATING: 1,
  SUCCESS: 2,
  ERROR: 3
};

export default class TagBulkDelete extends React.Component {
  static propTypes = {
    selectedEntityIds: PropTypes.array,
    reloadTagsFn: PropTypes.func,
    entityTagsMap: PropTypes.object
  };

  constructor(props) {
    super(props);
    this.state = {
      tagsToDelete: { [emptyTagPlaceholderKey]: 1 },
      entityStatuses: {}
    };
  }

  static contextType = PlatformStateContext;

  deleteTagsFromEntities = async () => {
    const { selectedEntityIds } = this.props;
    const { tagsToDelete, entityStatuses } = this.state;
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
        } else if (result.data?.taggingDeleteTagFromEntity?.errors?.length) {
          throw result.data.taggingDeleteTagFromEntity.errors;
        } else {
          const previousStatuses = this.state.entityStatuses;
          this.setState(
            {
              entityStatuses: {
                ...previousStatuses,
                [entityId]: ENTITY_UPDATE_STATUS.SUCCESS
              }
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
            [entityId]: ENTITY_UPDATE_STATUS.ERROR
          }
        });
      }
    });
  };

  changeTag = (fromTag, toTag) => {
    // eslint-disable-next-line react/no-access-state-in-setstate
    const newTags = { ...this.state.tagsToDelete };
    newTags[toTag] = newTags[fromTag] || 1;
    delete newTags[fromTag];
    this.setState({ tagsToDelete: newTags });
  };

  removeTag = tag => {
    // eslint-disable-next-line react/no-access-state-in-setstate
    const newTags = { ...this.state.tagsToDelete };
    delete newTags[tag];
    this.setState({ tagsToDelete: newTags });
  };

  addNewTag = () => {
    const { tagsToDelete } = this.state;
    this.setState({
      tagsToDelete: { ...tagsToDelete, [emptyTagPlaceholderKey]: 1 }
    });
  };

  render() {
    const { selectedEntityIds, entityTagsMap } = this.props;
    const { tagsToDelete, entityStatuses } = this.state;
    const currentTagList = Object.keys(tagsToDelete);
    const tagsOnEntities = Array.from(
      selectedEntityIds.reduce((accumulator, entityGuid) => {
        (entityTagsMap[entityGuid] || []).forEach(tag =>
          accumulator.add(tag.tagKey)
        );
        return accumulator;
      }, new Set())
    ).sort((a, b) => (a.toUpperCase() > b.toUpperCase() ? 1 : -1));
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
      resultText = 'Tags removed!';
    } else {
      resultText = 'Remove tags';
    }

    return (
      <div className="full-height-modal">
        <div>
          <HeadingText type={HeadingText.TYPE.HEADING_1}>
            Remove tags
          </HeadingText>
          <BlockText style={{ margin: '16px 0' }}>
            Choose tags to remove from the selected entities. This action cannot
            be undone, though you can always re-add tags to the entities at any
            time.
          </BlockText>
          <div style={{ margin: '0 8px 8px 0' }}>Select your tag</div>
          {Object.keys(tagsToDelete).map((tagKey, index) => {
            return (
              <div key={`add-tag-row-${index}`}>
                <div className="remove-tag-row">
                  <Select
                    className="full-width-select"
                    value={tagKey}
                    onChange={(e, value) => this.changeTag(tagKey, value)}
                  >
                    <SelectItem disabled value={emptyTagPlaceholderKey}>
                      Select tag
                    </SelectItem>
                    {tagsOnEntities.map(tag => {
                      return (
                        <SelectItem
                          key={`current-tag-select-${tag}`}
                          value={tag}
                          disabled={currentTagList.includes(tag)}
                        >
                          {tag}
                        </SelectItem>
                      );
                    })}
                  </Select>
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
                Remove additional tag
              </Button>
            </div>
          )}
        </div>
        <div>
          <div>
            {!!successEntities.length && (
              <div>
                Remove tags succeeded for {successEntities.length} entities
              </div>
            )}
            {!!errorEntities.length && (
              <div>Remove tags failed for {errorEntities.length} entities</div>
            )}
          </div>
          <div className="button-section">
            <Button
              type={Button.TYPE.DESTRUCTIVE}
              disabled={
                currentTagList.every(tag => tag === emptyTagPlaceholderKey) ||
                loadingEntities.length > 0 ||
                allSucceeded
              }
              onClick={this.deleteTagsFromEntities}
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
