import React from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Checkbox,
  Dropdown,
  DropdownSection,
  DropdownItem,
  Grid,
  GridItem,
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
import TagListing from './tag-listing';

import { COMPLIANCEBANDS } from '../tag-schema';

export default class TagEntityView extends React.Component {
  static propTypes = {
    tagHierarchy: PropTypes.object,
    entityTagsMap: PropTypes.object,
    getTagKeys: PropTypes.object,
    reloadTagsFn: PropTypes.func
  };

  state = {
    firstTagKey: 'account',
    table_column_1: TableHeaderCell.SORTING_TYPE.ASCENDING,
    selectedEntities: {},
    selectedEntityIds: [],
    showAllTags: true
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

  static contextType = NerdletStateContext;
  flushSelectedEntitiesTimeout = null;

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
              firstTagValue: this.findTagValue(entity, firstTagKey),
              complianceScore: entity.complianceScore,
              mandatoryTags: entity.mandatoryTags,
              optionalTags: entity.optionalTags
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
    const { selectedEntities } = this.state;
    selectedEntities[item.entityGuid] = evt.target.checked;
    clearTimeout(this.flushSelectedEntitiesTimeout);
    this.flushSelectedEntitiesTimeout = setTimeout(() => {
      this.setState({
        selectedEntityIds: Object.entries(selectedEntities)
          .filter(([, checked]) => checked)
          .map(([entityId]) => entityId)
      });

      this.flushSelectedEntitiesTimeout = null;
    }, 500);
  };

  onCheckboxChange = event => {
    const showAllTags = event.target.checked;

    this.setState({ showAllTags });
  };

  render() {
    const { updateFirstTagKey, setSortingColumn } = this;
    const {
      firstTagKey,
      selectedEntities,
      selectedEntityIds,
      showAllTags
    } = this.state;
    const { tagHierarchy, entityTagsMap, reloadTagsFn } = this.props;
    const tagKeys = this.props.getTagKeys;
    const entities = this.getTableData();
    const operableEntities = Object.keys(entityTagsMap).filter(entityId =>
      selectedEntityIds.includes(entityId)
    );
    const getBand = score => {
      if (score >= COMPLIANCEBANDS.highBand.lowerLimit) return 'high__band';
      else if (
        COMPLIANCEBANDS.midBand.lowerLimit <= score &&
        score < COMPLIANCEBANDS.midBand.upperLimit
      )
        return 'mid__band';
      else return 'low__band';
    };
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
                title={firstTagKey}
                items={tagKeys}
                style={{
                  display: 'inline-block',
                  margin: '0 .5em',
                  verticalAlign: 'middle'
                }}
                sectioned
              >
                {({ item: section, index }) => (
                  <DropdownSection
                    key={index}
                    title={section.title}
                    items={section.items}
                  >
                    {({ item, index }) => (
                      <DropdownItem
                        key={`d-${index}`}
                        onClick={() => updateFirstTagKey(item)}
                      >
                        {item}
                      </DropdownItem>
                    )}
                  </DropdownSection>
                )}
              </Dropdown>
            </div>
          </div>
          <div>
            <Checkbox
              checked={this.state.showAllTags}
              onChange={this.onCheckboxChange}
              label="Show all policy tags"
            />
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
                width="3fr"
                sortable
                sortingType={this.state.table_column_0}
                sortingOrder={1}
                onClick={(a, b) => setSortingColumn(0, a, b)}
              >
                Entity
              </TableHeaderCell>
              <TableHeaderCell
                value={({ item }) => item.firstTagValue}
                width="3fr"
                sortable
                sortingType={this.state.table_column_1}
                sortingOrder={2}
                onClick={(a, b) => setSortingColumn(1, a, b)}
              >
                {firstTagKey}
              </TableHeaderCell>
              <TableHeaderCell
                value={({ item }) => item.complianceScore}
                width="1fr"
                sortable
                sortingType={this.state.table_column_2}
                sortingOrder={3}
                onClick={(a, b) => setSortingColumn(2, a, b)}
              >
                Score
              </TableHeaderCell>
              <TableHeaderCell width="6fr">
                {showAllTags ? '' : 'Undefined'} Mandatory Tags
              </TableHeaderCell>
              <TableHeaderCell width="7fr">
                {showAllTags ? '' : 'Undefined'} Optional Tags
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
                <TableRowCell
                  width="1"
                  textAlign="center"
                  className={`score ${getBand(item.complianceScore)}`}
                >
                  {`${item.complianceScore.toFixed(2)}%`}
                </TableRowCell>
                <TableRowCell className="tag_nowrap_table_cell">
                  <TagListing
                    type="mandatory"
                    tags={item.mandatoryTags}
                    showAllTags={showAllTags}
                  />
                </TableRowCell>
                <TableRowCell className="tag_nowrap_table_cell">
                  <TagListing
                    type="optional"
                    tags={item.optionalTags}
                    showAllTags={showAllTags}
                  />
                </TableRowCell>
              </TableRow>
            )}
          </Table>
        </GridItem>
      </Grid>
    );
  }
}
