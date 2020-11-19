import React from 'react';
import {
  Button,
  Dropdown,
  DropdownItem,
  Grid,
  GridItem,
  HeadingText,
  Link,
  Table,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TableRowCell,
  navigation,
  NerdletStateContext,
  nerdlet
} from 'nr1';

import ModalButton from './modal-button';
import TagBulkAdd from './tag-bulk-add';
import TagBulkRename from './tag-bulk-rename';
import TagBulkEdit from './tag-bulk-edit';
import TagBulkDelete from './tag-bulk-delete';

export default class TagEntityView extends React.Component {
  flushSelectedEntitiesTimeout = null;
  static contextType = NerdletStateContext;
  state = {
    firstTagKey: 'account',
    table_column_1: TableHeaderCell.SORTING_TYPE.ASCENDING,
    selectedEntities: {},
    selectedEntityIds: []
  };

  componentDidMount() {
    const urlState = this.context || {};
    this.setState({
      firstTagKey: urlState.entityViewFirstTagKey || 'account',
      [`table_column_${urlState.entityViewSortColumn || 1}`]:
        urlState.entityViewSortDirection ||
        TableHeaderCell.SORTING_TYPE.ASCENDING
    });
  }

  setSortingColumn = (columnId, event, sortingData) => {
    const updates = [0, 1, 2, 3].reduce((acc, column) => {
      acc[`table_column_${column}`] =
        column === columnId ? sortingData.nextSortingType : undefined;
      if (column === columnId) {
        nerdlet.setUrlState({
          entityViewSortColumn: column,
          entityViewSortDirection: sortingData.nextSortingType
        });
      }
      return acc;
    }, {});
    this.setState(updates);
  };

  updateFirstTagKey = firstTagKey => {
    this.setState({ firstTagKey });
    nerdlet.setUrlState({ entityViewFirstTagKey: firstTagKey });
  };

  getTagKeys = () => {
    const { tagHierarchy } = this.props;
    return Object.keys(tagHierarchy).sort();
  };

  getTableData = () => {
    const { tagHierarchy } = this.props;
    const { firstTagKey } = this.state;

    const entities = {};
    for (const tagData of Object.values(tagHierarchy)) {
      for (const entityList of Object.values(tagData)) {
        for (const entity of entityList) {
          if (!entities[entity.guid]) {
            entities[entity.guid] = {
              entityName: entity.name,
              entityGuid: entity.guid,
              firstTagValue: this.findTagValue(entity, firstTagKey)
            };
          }
        }
      }
    }
    return Object.values(entities);
  };

  findTagValue = (entity, tagKey) => {
    const tag =
      ((entity.tags || []).find(t => t.tagKey === tagKey) || {}).tagValues ||
      [];
    return tag.join(', ');
  };

  onSelectEntity = (evt, { item }) => {
    const { selectedEntities, selectedEntityIds } = this.state;
    selectedEntities[item.entityGuid] = evt.target.checked;
    clearTimeout(this.flushSelectedEntitiesTimeout);
    this.flushSelectedEntitiesTimeout = setTimeout(() => {
      this.setState({
        selectedEntityIds: Object.entries(selectedEntities)
          .filter(([entityId, checked]) => checked)
          .map(([entityId, checked]) => entityId)
      });

      this.flushSelectedEntitiesTimeout = null;
    }, 500);
  };

  render() {
    const { updateFirstTagKey } = this;
    const {
      firstTagKey,
      selectedEntities,
      selectedEntityIds
    } = this.state;
    const { tagHierarchy, entityTagsMap, reloadTagsFn } = this.props;
    const tagKeys = this.getTagKeys();
    const entities = this.getTableData();
    const operableEntities = Object.keys(entityTagsMap).filter(entityId =>
      selectedEntityIds.includes(entityId)
    );
    return (
      <Grid className="primary-grid">
        <GridItem
          className="primary-content-container entity-view-header-bar"
          columnSpan={12}
        >
          <div>
            <div>
              Show values for this tag in the table:
              <Dropdown
                style={{ display: 'inline', margin: '0 1em' }}
                title={firstTagKey}
                items={tagKeys}
                style={{
                  display: 'inline-block',
                  margin: '0 .5em',
                  verticalAlign: 'middle'
                }}
              >
                {({ item, index }) => (
                  <DropdownItem
                    key={`d-${index}`}
                    onClick={() => updateFirstTagKey(item)}
                  >
                    {item}
                  </DropdownItem>
                )}
              </Dropdown>
            </div>
          </div>
          <div className="button-section" style={{ padding: 8 }}>
            <ModalButton
              disabled={!operableEntities.length}
              buttonText="Add tags"
              buttonType={Button.TYPE.PRIMARY}
            >
              <TagBulkAdd
                tagHierarchy={tagHierarchy}
                entities={entities}
                selectedEntityIds={operableEntities}
                reloadTagsFn={reloadTagsFn}
              />
            </ModalButton>
            <ModalButton
              disabled={!operableEntities.length}
              buttonText="Rename tags"
              buttonType={Button.TYPE.PRIMARY}
            >
              <TagBulkRename
                tagHierarchy={tagHierarchy}
                entities={entities}
                selectedEntityIds={operableEntities}
                entityTagsMap={entityTagsMap}
                reloadTagsFn={reloadTagsFn}
              />
            </ModalButton>
            <ModalButton
              disabled={!operableEntities.length}
              buttonText="Change values"
              buttonType={Button.TYPE.PRIMARY}
            >
              <TagBulkEdit
                tagHierarchy={tagHierarchy}
                entities={entities}
                selectedEntityIds={operableEntities}
                entityTagsMap={entityTagsMap}
                reloadTagsFn={reloadTagsFn}
              />
            </ModalButton>
            <ModalButton
              disabled={!operableEntities.length}
              buttonText="Remove tags"
              buttonType={Button.TYPE.PRIMARY}
            >
              <TagBulkDelete
                tagHierarchy={tagHierarchy}
                entities={entities}
                selectedEntityIds={operableEntities}
                entityTagsMap={entityTagsMap}
                reloadTagsFn={reloadTagsFn}
              />
            </ModalButton>
          </div>
        </GridItem>

        <GridItem className="primary-content-container" columnSpan={12}>
          <Table
            items={entities}
            selected={({ item }) => selectedEntities[item.entityGuid]}
            onSelect={this.onSelectEntity}
          >
            <TableHeader>
              <TableHeaderCell
                value={({ item }) => item.entityName}
                sortable
                sortingType={this.state.table_column_0}
                sortingOrder={1}
                onClick={this.setSortingColumn.bind(this, 0)}
              >
                Entity
              </TableHeaderCell>
              <TableHeaderCell
                value={({ item }) => item.firstTagValue}
                sortable
                sortingType={this.state.table_column_1}
                sortingOrder={2}
                onClick={this.setSortingColumn.bind(this, 1)}
              >
                {firstTagKey}
              </TableHeaderCell>
            </TableHeader>

            {({ item }) => (
              <TableRow>
                <TableRowCell>
                  <Link to={navigation.getOpenEntityLocation(item.entityGuid)}>
                    {item.entityName}
                  </Link>
                </TableRowCell>
                <TableRowCell>{item.firstTagValue}</TableRowCell>
              </TableRow>
            )}
          </Table>
        </GridItem>
      </Grid>
    );
  }
}
