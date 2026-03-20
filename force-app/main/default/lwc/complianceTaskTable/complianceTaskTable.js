import { LightningElement, api } from 'lwc';
import getTaskPage from '@salesforce/apex/ComplianceSummaryController.getTaskPage';

const PAGE_SIZE = 6;
const SCROLL_LOAD_THRESHOLD = 24;

const UPCOMING_COLUMNS = [
    {
        label: 'TASK NAME',
        fieldName: 'taskRecordUrl',
        type: 'url',
        typeAttributes: {
            label: { fieldName: 'taskName' },
            target: '_self'
        },
        sortable: true
    },
    {
        label: 'CLAUSE ID',
        fieldName: 'clauseRecordUrl',
        type: 'url',
        typeAttributes: {
            label: { fieldName: 'clauseAutoNumber' },
            target: '_self'
        },
        sortable: true
    },
    { label: 'CLAUSE NAME', fieldName: 'clauseName', type: 'text', sortable: true },
    { label: 'ASSIGNED TO', fieldName: 'ownerName', type: 'text', sortable: true },
    { label: 'DUE DATE', fieldName: 'dueDate', type: 'date', sortable: true },
    { label: 'PRIORITY', fieldName: 'priority', type: 'text', sortable: true }
];

const OVERDUE_COLUMNS = [
    {
        label: 'TASK NAME',
        fieldName: 'taskRecordUrl',
        type: 'url',
        typeAttributes: {
            label: { fieldName: 'taskName' },
            target: '_self'
        },
        sortable: true,
        cellAttributes: {
            class: { fieldName: 'overdueCellClass' }
        }
    },
    {
        label: 'CLAUSE ID',
        fieldName: 'clauseRecordUrl',
        type: 'url',
        typeAttributes: {
            label: { fieldName: 'clauseAutoNumber' },
            target: '_self'
        },
        sortable: true,
        cellAttributes: {
            class: { fieldName: 'overdueCellClass' }
        }
    },
    {
        label: 'CLAUSE NAME',
        fieldName: 'clauseName',
        type: 'text',
        sortable: true,
        cellAttributes: {
            class: { fieldName: 'overdueCellClass' }
        }
    },
    {
        label: 'ASSIGNED TO',
        fieldName: 'ownerName',
        type: 'text',
        sortable: true,
        cellAttributes: {
            class: { fieldName: 'overdueCellClass' }
        }
    },
    {
        label: 'DUE DATE',
        fieldName: 'dueDate',
        type: 'text',
        sortable: true,
        cellAttributes: {
            class: { fieldName: 'dueDateClass' }
        }
    },
    {
        label: 'DAYS OVERDUE',
        fieldName: 'daysOverdueLabel',
        type: 'text',
        sortable: true,
        cellAttributes: {
            class: { fieldName: 'overdueBadgeClass' }
        }
    }
];

export default class ComplianceTaskTable extends LightningElement {
    @api title;
    @api recordCount = 0;
    @api rows = [];
    @api tableType;
    @api helperText;
    @api recordId;

    displayRows = [];
    initialRows = [];
    currentOffset = 0;
    hasMore = false;
    isLoadingMore = false;
    initialized = false;
    isExpanded = false;
    sortedBy;
    sortDirection = 'asc';

    connectedCallback() {
        this.initializeRows();
    }

    renderedCallback() {
        if (!this.initialized) {
            this.initializeRows();
        }
    }

    @api
    refreshTable() {
        this.initializeRows();
    }

    initializeRows() {
        const sourceRows = this.decorateRows([...(this.rows || [])]);
        this.initialRows = sourceRows.slice(0, PAGE_SIZE);
        this.displayRows = [...this.initialRows];
        this.currentOffset = this.displayRows.length;
        this.hasMore = this.recordCount > this.displayRows.length;
        this.isExpanded = false;
        this.initialized = true;
        this.resetScrollPosition();
    }

    decorateRows(rows) {
        if (!this.isOverdueTable) {
            return rows;
        }

        return rows.map((row) => ({
            ...row,
            overdueCellClass: 'overdue-cell',
            dueDateClass: 'slds-text-color_error slds-text-title_bold',
            // overdueBadgeClass: 'overdue-badge-cell slds-text-color_error slds-text-title_bold'
        }));
    }

    get columns() {
        return this.isOverdueTable ? OVERDUE_COLUMNS : UPCOMING_COLUMNS;
    }

    get isOverdueTable() {
        return this.tableType === 'overdue';
    }

    get showEmptyState() {
        return this.recordCount === 0;
    }

    get tableContainerClass() {
        let baseClass = 'task-card__table-container';
        if (this.isOverdueTable) {
            baseClass += ' task-card__table-container_overdue';
        }
        return baseClass;
    }

    get scrollWrapperClass() {
        let baseClass = 'task-card__scroll-wrapper';
        if (this.isExpanded && this.recordCount > PAGE_SIZE) {
            baseClass += ' task-card__scroll-wrapper_fixed';
        }
        if (this.isOverdueTable) {
            baseClass += ' task-card__scroll-wrapper_overdue';
        }
        return baseClass;
    }

    get showViewMore() {
        return this.recordCount > PAGE_SIZE && !this.isExpanded;
    }

    get showShowLess() {
        return this.recordCount > PAGE_SIZE && this.isExpanded;
    }

    get showActions() {
        return this.recordCount > PAGE_SIZE;
    }

    get helperTextClass() {
        return this.isOverdueTable
            ? 'task-card__helper-text task-card__helper-text_overdue'
            : 'task-card__helper-text';
    }

    handleSort(event) {
        const { fieldName: sortedBy, sortDirection } = event.detail;

        const cloneData = [...this.displayRows];

        cloneData.sort((a, b) => {
            let valueA = a[sortedBy];
            let valueB = b[sortedBy];

            if (sortedBy === 'taskRecordUrl') {
                valueA = a.taskName;
                valueB = b.taskName;
            } else if (sortedBy === 'clauseRecordUrl') {
                valueA = a.clauseAutoNumber;
                valueB = b.clauseAutoNumber;
            } else if (sortedBy === 'daysOverdueLabel') {
                valueA = parseInt(a.daysOverdueLabel, 10) || 0;
                valueB = parseInt(b.daysOverdueLabel, 10) || 0;
            } else if (sortedBy === 'dueDate') {
                valueA = new Date(a.dueDate).getTime() || 0;
                valueB = new Date(b.dueDate).getTime() || 0;
            }

            valueA = valueA ?? '';
            valueB = valueB ?? '';

            if (typeof valueA === 'string') {
                valueA = valueA.toLowerCase();
            }
            if (typeof valueB === 'string') {
                valueB = valueB.toLowerCase();
            }

            if (valueA > valueB) {
                return sortDirection === 'asc' ? 1 : -1;
            }
            if (valueA < valueB) {
                return sortDirection === 'asc' ? -1 : 1;
            }
            return 0;
        });

        this.displayRows = cloneData;
        this.sortedBy = sortedBy;
        this.sortDirection = sortDirection;
    }

    async handleViewMore() {
        if (this.isLoadingMore || !this.recordId) {
            return;
        }

        this.isExpanded = true;

        if (this.hasMore) {
            await this.loadMoreRows();
        }
    }

    async handleTableScroll(event) {
        if (!this.isExpanded || !this.hasMore || this.isLoadingMore || !this.recordId) {
            return;
        }

        const target = event.target;
        const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;

        if (distanceFromBottom <= SCROLL_LOAD_THRESHOLD) {
            await this.loadMoreRows();
        }
    }

    async loadMoreRows() {
        if (this.isLoadingMore || !this.recordId || !this.hasMore) {
            return;
        }

        this.isLoadingMore = true;

        try {
            const response = await getTaskPage({
                complianceId: this.recordId,
                tableType: this.tableType,
                offsetSize: this.currentOffset,
                pageSize: PAGE_SIZE
            });

            const newRows = this.decorateRows(response && response.rows ? response.rows : []);
            this.displayRows = [...this.displayRows, ...newRows];
            this.currentOffset = this.displayRows.length;
            this.hasMore = response ? response.hasMore : false;
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error loading more tasks', error);
        } finally {
            this.isLoadingMore = false;
        }
    }

    handleShowLess() {
        this.displayRows = [...this.initialRows];
        this.currentOffset = this.displayRows.length;
        this.hasMore = this.recordCount > this.displayRows.length;
        this.isExpanded = false;
        this.resetScrollPosition();
    }

    resetScrollPosition() {
        requestAnimationFrame(() => {
            const scroller = this.template.querySelector('[data-id="tableScroller"]');
            if (scroller) {
                scroller.scrollTop = 0;
            }
        });
    }
}