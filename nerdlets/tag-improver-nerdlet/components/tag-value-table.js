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
    getTableData: PropTypes.func
  };

  constructor(props) {
    super(props);
    this.state = {
      value_column_0: TableHeaderCell.SORTING_TYPE.ASCENDING
    };
  }

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
    const { setSortingColumn } = this;

    return (
      <Table items={this.props.getTableData()}>
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
            Tagged entities
          </TableHeaderCell>
        </TableHeader>

        {({ item }) => (
          <TableRow>
            <TableRowCell>{item.tagValue}</TableRowCell>
            <TableRowCell>{item.entityCount}</TableRowCell>
          </TableRow>
        )}
      </Table>
    );
  }
}
