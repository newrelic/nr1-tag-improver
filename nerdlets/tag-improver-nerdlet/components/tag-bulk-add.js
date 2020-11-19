import React from "react";
import {
  HeadingText,
  PlatformStateContext,
  BlockText,
  Button,
  NerdGraphMutation,
} from "nr1";
import Autocomplete from "./autocomplete";

const emptyTagPlaceholderKey = "🏷️helloIAmTag";

const ENTITY_UPDATE_STATUS = {
  NONE: 0,
  UPDATING: 1,
  SUCCESS: 2,
  ERROR: 3,
};

export default class TagBulkAdd extends React.Component {
  static contextType = PlatformStateContext;

  constructor(props) {
    super(props);
    this.state = {
      tagsToAdd: { [emptyTagPlaceholderKey]: "" },
      entityStatuses: {},
    };
  }

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
        ([entityId, entityStatus]) =>
          entityStatus !== ENTITY_UPDATE_STATUS.SUCCESS
      );
    } else {
      entitiesToUpdate = selectedEntityIds;
    }
    const statusObject = { ...entityStatuses };
    entitiesToUpdate.forEach((entityId) => {
      if (!statusObject[entityId]) {
        statusObject[entityId] = ENTITY_UPDATE_STATUS.UPDATING;
      }
    });
    this.setState({ entityStatuses: statusObject });
    await entitiesToUpdate.map(async (entityId, index) => {
      const variables = { entityGuid: entityId, entityTags: tagsForGql };
      try {
        const result = await NerdGraphMutation.mutate({ mutation, variables });
        if (result.errors?.length) {
          throw result.errors;
        } else if (result.data?.taggingAddTagsToEntity?.errors?.length) {
          throw result.data.taggingAddTagsToEntity.errors;
        } else {
          this.setState(
            {
              entityStatuses: {
                ...this.state.entityStatuses,
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
        console.log("Add tag error for " + entityId, error);
        this.setState({
          entityStatuses: {
            ...this.state.entityStatuses,
            [entityId]: ENTITY_UPDATE_STATUS.ERROR,
          },
        });
      }
    });
  };

  changeTag = (fromTag, toTag) => {
    const newTags = { ...this.state.tagsToAdd };
    newTags[toTag] = newTags[fromTag] || "";
    delete newTags[fromTag];
    this.setState({ tagsToAdd: newTags });
  };

  removeTag = (tag) => {
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
      tagsToAdd: { ...tagsToAdd, [emptyTagPlaceholderKey]: "" },
    });
  };

  render() {
    const { tags, entities, selectedEntityIds, tagHierarchy } = this.props;
    const { tagsToAdd, entityStatuses } = this.state;
    const currentTagList = Object.keys(tagsToAdd);
    const existingTags = Object.keys(tagHierarchy);
    const availableTagsList = existingTags
      .filter((tag) => !currentTagList.includes(tag))
      .sort((a, b) => (a.toUpperCase() > b.toUpperCase() ? 1 : -1));
    const availableTagsDictionary = availableTagsList.reduce(
      (accumulator, tag) => ((accumulator[tag] = tag), accumulator),
      {}
    );
    const canAddNewTag =
      currentTagList.length < 10 &&
      !currentTagList.includes(emptyTagPlaceholderKey);
    const statusEntries = Object.entries(entityStatuses);
    const loadingEntities = statusEntries
      .filter(([entityId, status]) => status === ENTITY_UPDATE_STATUS.UPDATING)
      .map(([entityId, status]) => entityId);
    const successEntities = statusEntries
      .filter(([entityId, status]) => status === ENTITY_UPDATE_STATUS.SUCCESS)
      .map(([entityId, status]) => entityId);
    const errorEntities = statusEntries
      .filter(([entityId, status]) => status === ENTITY_UPDATE_STATUS.ERROR)
      .map(([entityId, status]) => entityId);
    const allSucceeded = successEntities.length === selectedEntityIds.length;
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
                    placeholder={"Tag"}
                    value={tagKey === emptyTagPlaceholderKey ? "" : tagKey}
                  />

                  <Autocomplete
                    choices={Object.keys(tagHierarchy[tagKey] || {}).reduce(
                      (accumulator, tag) => (
                        (accumulator[tag] = tag), accumulator
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
                    <div style={{ width: 32 }}></div>
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
                currentTagList.every((tag) => tag === emptyTagPlaceholderKey) ||
                loadingEntities.length > 0 ||
                allSucceeded
              }
              onClick={this.applyTagsToEntities}
              loading={loadingEntities.length > 0}
            >
              {errorEntities.length > 0
                ? "Retry"
                : allSucceeded
                ? "Tags Added!"
                : "Add tags"}
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
