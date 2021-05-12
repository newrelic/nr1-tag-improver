import React from 'react';
import PropTypes from 'prop-types';

import {
  HeadingText,
  PlatformStateContext,
  Button,
  Select,
  SelectItem,
  logger
} from 'nr1';
import Autocomplete from './autocomplete';

import { addTagAndValues, deleteTags } from './commonUtils';

const ENTITY_UPDATE_STATUS = {
  NONE: 0,
  ADDING: 1,
  ADD_ERROR: 2,
  REMOVING: 3,
  REMOVE_ERROR: 4,
  SUCCESS: 5
};

export default class TagBulkRename extends React.Component {
  static propTypes = {
    selectedEntityIds: PropTypes.array,
    tagHierarchy: PropTypes.object,
    entityTagsMap: PropTypes.object,
    reloadTagsFn: PropTypes.func
  };

  constructor(props) {
    super(props);
    this.state = {
      entityStatuses: {},
      selectedCurrentTag: '',
      selectedNewTag: ''
    };
  }

  static contextType = PlatformStateContext;

  applyRenameToEntities = async () => {
    const { selectedEntityIds, entityTagsMap } = this.props;
    const { selectedCurrentTag, selectedNewTag, entityStatuses } = this.state;

    let entitiesToUpdate;
    //  entityStatus format is array [ <GUID>, <ENTITY_UPDATE_STATUS.SUCCESS> ]
    const statusEntries = Object.entries(entityStatuses);
    if (statusEntries.length) {
      entitiesToUpdate = statusEntries
        .filter(
          ([, entityStatus]) => entityStatus !== ENTITY_UPDATE_STATUS.SUCCESS
        )
        .map(item => item[0]);
    } else {
      entitiesToUpdate = selectedEntityIds;
    }
    const statusObject = { ...entityStatuses };
    entitiesToUpdate.forEach(entityId => {
      if (statusObject[entityId]) {
        statusObject[entityId] = ENTITY_UPDATE_STATUS.ADDING;
      }
    });

    const setEntityStatusFn = async function(entityId, hasErrors = false) {
      const previousStatuses = this.state.entityStatuses;
      this.setState({
        entityStatuses: {
          ...previousStatuses,
          [entityId]: hasErrors
            ? ENTITY_UPDATE_STATUS.ERROR
            : ENTITY_UPDATE_STATUS.SUCCESS
        }
      });
    }.bind(this);

    this.setState({ entityStatuses: statusObject });
    const { passEntityIds: updatedEntityIds } = await addTagAndValues({
      entitiesToUpdate,
      entityTagsMap,
      currentTagKey: selectedCurrentTag,
      newTagKey: selectedNewTag,
      setEntityStatusFn,
      maxThreads: 2
    });

    if (updatedEntityIds && updatedEntityIds.length === 0) {
      logger.warn(`Bulk edit: WARNING: NO Tags to delete, skipping`);
      return;
    }

    await deleteTags({
      entitiesToUpdate: updatedEntityIds,
      tagsToDelete: selectedCurrentTag,
      setEntityStatusFn,
      maxThreads: 2
    });
    await this.props.reloadTagsFn(selectedEntityIds);
  };

  changeCurrentTag = (e, value) => this.setState({ selectedCurrentTag: value });
  changeNewTag = (e, value) => this.setState({ selectedNewTag: value });

  render() {
    const { selectedEntityIds, tagHierarchy, entityTagsMap } = this.props;
    const { entityStatuses, selectedCurrentTag, selectedNewTag } = this.state;
    const tagsOnEntities = Array.from(
      selectedEntityIds.reduce((accumulator, entityGuid) => {
        (entityTagsMap[entityGuid] || []).forEach(tag =>
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
            {tagsOnEntities.map(tag => {
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
