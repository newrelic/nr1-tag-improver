import React from 'react';
import {
  Table,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TableRowCell
} from 'nr1';

export default class TagValueTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      value_column_0: TableHeaderCell.SORTING_TYPE.ASCENDING
    };
  }

  setSortingColumn = (columnId, event, sortingData) => {
    const updates = [0, 1].reduce((acc, column) => {
      acc[`value_column_${column}`] =
        column === columnId ? sortingData.nextSortingType : undefined;
      return acc;
    }, {});
    this.setState(updates);
  };

  render() {
    return (
      <Table items={this.props.getTableData()}>
        <TableHeader>
          <TableHeaderCell
            value={({ item }) => item.tagValue}
            sortable
            sortingType={this.state.value_column_0}
            sortingOrder={1}
            onClick={this.setSortingColumn.bind(this, 0)}
          >
            Tag name
          </TableHeaderCell>
          <TableHeaderCell
            value={({ item }) => item.entityCount}
            sortable
            sortingType={this.state.value_column_1}
            sortingOrder={2}
            onClick={this.setSortingColumn.bind(this, 1)}
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
