import React from 'react';
import PropTypes from 'prop-types';

import {
  Table,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TableRowCell
} from 'nr1';

export default class TagValueTable extends React.Component {
  static propTypes = {
    getTableData: PropTypes.func,
    onShowEntities: PropTypes.func
  };

  constructor(props) {
    super(props);
    this.state = {
      value_column_0: TableHeaderCell.SORTING_TYPE.ASCENDING
    };
  }

  openEntities = item => {
    this.props.onShowEntities(item);
  };

  setSortingColumn = (columnId, event, sortingData) => {
    const nextType = sortingData ? sortingData.nextSortingType : undefined;
    const updates = [0, 1].reduce((acc, column) => {
      acc[`value_column_${column}`] =
        column === columnId ? nextType : undefined;
      return acc;
    }, {});
    this.setState(updates);
  };

  render() {
    const { setSortingColumn, openEntities } = this;

    return (
      <Table
        items={this.props.getTableData().filter(item => {
          return item.entityCount > 0;
        })}
      >
        <TableHeader>
          <TableHeaderCell
            value={({ item }) => item.tagValue}
            sortable
            sortingType={this.state.value_column_0}
            sortingOrder={1}
            onClick={(a, b) => setSortingColumn(0, a, b)}
          >
            Tag value
          </TableHeaderCell>
          <TableHeaderCell
            value={({ item }) => item.entityCount}
            sortable
            sortingType={this.state.value_column_1}
            sortingOrder={2}
            onClick={(a, b) => setSortingColumn(1, a, b)}
          >
            Entity count
          </TableHeaderCell>
          <TableHeaderCell value={({ item }) => item}>
            Manage entities
          </TableHeaderCell>
        </TableHeader>

        {({ item }) => (
          <TableRow>
            <TableRowCell
              className={
                item.tagValue === '<tag not defined>' && item.entityCount
                  ? 'tag__value__blank__row'
                  : 'tag__value__normal__row'
              }
            >
              {item.tagValue}
            </TableRowCell>
            <TableRowCell
              className={
                item.tagValue === '<tag not defined>' && item.entityCount
                  ? 'tag__value__blank__row'
                  : 'tag__value__normal__row'
              }
            >
              {item.entityCount}
            </TableRowCell>
            <TableRowCell>
              {item.entityCount ? (
                <a onClick={() => openEntities(item)}>Manage</a>
              ) : (
                ''
              )}
            </TableRowCell>
          </TableRow>
        )}
      </Table>
    );
  }
}
