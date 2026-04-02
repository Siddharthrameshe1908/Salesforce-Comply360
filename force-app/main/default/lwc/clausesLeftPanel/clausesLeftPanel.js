import { LightningElement, api, track, wire } from "lwc";
import { refreshApex } from "@salesforce/apex";
import getClauseCards from "@salesforce/apex/ClausesController.getClauseCards";

const MIN_PAGE_SIZE = 8;
const MAX_PAGE_SIZE = 25;
const TABLE_CHROME_HEIGHT = 42;
const ESTIMATED_ROW_HEIGHT = 45;
const ALL = "ALL";
const EMPTY_FILTERS = () => ({ risk: ALL, status: ALL, domain: ALL, reviewer: ALL, type: ALL });
const COLUMNS = [
    {
        label: "Clause Name",
        fieldName: "clauseName",
        type: "button",
        sortable: true,
        typeAttributes: {
            label: { fieldName: "clauseName" },
            name: "open_clause",
            variant: "base",
            title: "Open Clause"
        }
    },
    { label: "Clause ID", fieldName: "clauseNumber", type: "text", sortable: true },
    { label: "Risk", fieldName: "riskLevel", type: "text", sortable: true },
    {
        label: "Status",
        fieldName: "status",
        type: "text",
        cellAttributes: {
            class: { fieldName: "statusClass" }
        },
        sortable: true
    },
    { label: "Reviewer", fieldName: "reviewer", type: "text", sortable: true },
    { label: "Type", fieldName: "type", type: "text", sortable: true }
];

export default class ClausesLeftPanel extends LightningElement {
    _recordId;
    isLoading = false;

    pageSize = MIN_PAGE_SIZE;
    currentPage = 1;
    searchText = "";
    isPopoverOpen = false;
    sortBy = "clauseName";
    sortDirection = "asc";

    @track clauses = [];
    @track filters = EMPTY_FILTERS();
    @track draft = EMPTY_FILTERS();

    _wiredResult;
    _statusStylesInjected = false;
    _resizeHandlerBound = false;
    columns = COLUMNS;

    @api
    get recordId() {
        return this._recordId;
    }

    set recordId(value) {
        this._recordId = value;
        this.isLoading = Boolean(value);
    }

    renderedCallback() {
        if (this._statusStylesInjected) {
            this.updateDynamicPageSize();
            return;
        }

        this._statusStylesInjected = true;
        this.injectStatusStyles();
        this.bindResizeListener();
        this.updateDynamicPageSize();
    }

    disconnectedCallback() {
        if (this._resizeHandlerBound) {
            window.removeEventListener("resize", this.handleResize);
            this._resizeHandlerBound = false;
        }
    }

    @wire(getClauseCards, { complianceId: "$_recordId" })
    wiredClauseCards(result) {
        this._wiredResult = result;
        const { data, error } = result;
        if (data) {
            this.clauses = (data || []).map((c) => ({
                clauseId: c.clauseId,
                clauseNumber: c.clauseNumber,
                clauseName: c.clauseName,
                riskLevel: c.riskLevel || "",
                status: c.status || "",
                statusClass: this.getStatusClass(c.status),
                industryDomain: c.industryDomain || "",
                reviewer: c.reviewer || "",
                type: c.type || "",
                documentName: c.documentName || ""
            }));
            this.currentPage = 1;
            this.isLoading = false;
        } else if (error) {
            this.clauses = [];
            this.currentPage = 1;
            this.isLoading = false;
        }
    }

    @api refresh() {
        this.isLoading = true;
        refreshApex(this._wiredResult);
    }

    toggleFilterPopover = () => {
        this.isPopoverOpen = !this.isPopoverOpen;
        if (this.isPopoverOpen) {
            this.draft = { ...this.filters };
        }
    };

    applyFilters = () => {
        this.filters = { ...this.draft };
        this.isPopoverOpen = false;
        this.currentPage = 1;
    };

    clearDraft = () => {
        this.draft = EMPTY_FILTERS();
    };

    handleDraftRisk = (e) => {
        this.draft = { ...this.draft, risk: e.detail.value };
    };

    handleDraftStatus = (e) => {
        this.draft = { ...this.draft, status: e.detail.value };
    };

    handleDraftDomain = (e) => {
        this.draft = { ...this.draft, domain: e.detail.value };
    };

    handleDraftReviewer = (e) => {
        this.draft = { ...this.draft, reviewer: e.detail.value };
    };

    handleDraftType = (e) => {
        this.draft = { ...this.draft, type: e.detail.value };
    };

    get activeChips() {
        const f = this.filters;
        const chips = [];
        if (f.risk !== ALL) chips.push({ key: "risk", label: `Risk: ${f.risk}` });
        if (f.status !== ALL) chips.push({ key: "status", label: `Status: ${f.status}` });
        if (f.domain !== ALL) chips.push({ key: "domain", label: `Domain: ${f.domain}` });
        if (f.reviewer !== ALL) chips.push({ key: "reviewer", label: `Reviewer: ${f.reviewer}` });
        if (f.type !== ALL) chips.push({ key: "type", label: `Type: ${f.type}` });
        return chips;
    }

    get hasActiveFilters() {
        return this.activeChips.length > 0;
    }

    get activeFilterCount() {
        return this.activeChips.length || null;
    }

    get filterBtnVariant() {
        return this.hasActiveFilters ? "brand" : "border-filled";
    }

    removeChip = (e) => {
        const key = e.currentTarget.dataset.key;
        this.filters = { ...this.filters, [key]: ALL };
        this.currentPage = 1;
    };

    get riskComboOptions() {
        return this.makeOpts(["Low", "Medium", "High", "Critical"], (c) => c.riskLevel);
    }

    get statusComboOptions() {
        return this.makeOpts(["Draft", "In Review", "Approved", "Enforced", "Suspended", "Obsolete"], (c) => c.status);
    }

    get domainComboOptions() {
        return this.makeOpts(["Energy", "Environmental", "Healthcare", "Information Technology", "Manufacturing"], (c) => c.industryDomain);
    }

    get reviewerComboOptions() {
        return this.makeOpts(["Susan", "Michael", "John"], (c) => c.reviewer);
    }

    get typeComboOptions() {
        return this.makeOpts(["3 Months", "6 Months", "1 Year", "One-Time (No Recurrence)"], (c) => c.type);
    }

    makeOpts(values, fn) {
        const counts = new Map();
        for (const c of this.clauses) {
            const key = fn(c) || "";
            counts.set(key, (counts.get(key) || 0) + 1);
        }

        return [
            { label: "All", value: ALL },
            ...values.map((value) => ({ label: `${value} (${counts.get(value) || 0})`, value }))
        ];
    }

    get filteredClauses() {
        const searchTerm = (this.searchText || "").trim().toLowerCase();
        const f = this.filters;

        return this.clauses.filter((c) => {
            if (f.risk !== ALL && c.riskLevel !== f.risk) return false;
            if (f.status !== ALL && c.status !== f.status) return false;
            if (f.domain !== ALL && c.industryDomain !== f.domain) return false;
            if (f.reviewer !== ALL && c.reviewer !== f.reviewer) return false;
            if (f.type !== ALL && c.type !== f.type) return false;

            if (
                searchTerm &&
                !`${c.clauseName} ${c.clauseNumber} ${c.clauseId} ${c.documentName} ${c.reviewer}`
                    .toLowerCase()
                    .includes(searchTerm)
            ) {
                return false;
            }

            return true;
        });
    }

    get sortedClauses() {
        const data = [...this.filteredClauses];
        data.sort((a, b) => this.compareValues(a[this.sortBy], b[this.sortBy], this.sortDirection));
        return data;
    }

    get totalPages() {
        return Math.ceil(this.sortedClauses.length / this.pageSize);
    }

    get normalizedCurrentPage() {
        if (this.totalPages === 0) {
            return 1;
        }
        return Math.min(Math.max(this.currentPage, 1), this.totalPages);
    }

    get pagedTableData() {
        if (this.totalPages === 0) {
            return [];
        }
        const page = this.normalizedCurrentPage;
        const start = (page - 1) * this.pageSize;
        return this.sortedClauses.slice(start, start + this.pageSize);
    }

    get pageButtons() {
        return Array.from({ length: this.totalPages }, (_, index) => {
            const page = index + 1;
            return {
                page,
                label: `${page}`,
                variant: page === this.normalizedCurrentPage ? "brand" : "neutral"
            };
        });
    }

    get showPagination() {
        return this.totalPages > 1;
    }

    get isPreviousDisabled() {
        return this.normalizedCurrentPage <= 1;
    }

    get isNextDisabled() {
        return this.normalizedCurrentPage >= this.totalPages;
    }

    get startRecord() {
        if (this.totalPages === 0) {
            return 0;
        }
        return (this.normalizedCurrentPage - 1) * this.pageSize + 1;
    }

    get endRecord() {
        if (this.totalPages === 0) {
            return 0;
        }
        return Math.min(this.normalizedCurrentPage * this.pageSize, this.filteredCount);
    }

    get filteredCount() {
        return this.filteredClauses.length;
    }

    get totalCount() {
        return this.clauses.length || null;
    }

    get noResults() {
        return this.sortedClauses.length === 0;
    }

    handleSearch = (e) => {
        this.searchText = e.target.value;
        this.currentPage = 1;
    };

    handleRowAction = (event) => {
        const actionName = event.detail.action?.name;
        const row = event.detail.row;

        if (actionName !== "open_clause" || !row?.clauseId) {
            return;
        }

        this.isPopoverOpen = false;
        this.dispatchClauseSelect(row.clauseId, row.status, row.clauseName);
    };

    handleSort = (event) => {
        this.sortBy = event.detail.fieldName;
        this.sortDirection = event.detail.sortDirection;
    };

    handlePreviousPage = () => {
        if (this.isPreviousDisabled) {
            return;
        }
        this.currentPage = this.normalizedCurrentPage - 1;
    };

    handleNextPage = () => {
        if (this.isNextDisabled) {
            return;
        }
        this.currentPage = this.normalizedCurrentPage + 1;
    };

    handlePageClick = (event) => {
        const page = parseInt(event.currentTarget.dataset.page, 10);
        if (!Number.isNaN(page)) {
            this.currentPage = page;
        }
    };

    handleResize = () => {
        this.updateDynamicPageSize();
    };

    dispatchClauseSelect(clauseId, status, clauseName) {
        this.dispatchEvent(
            new CustomEvent("clauseselect", {
                detail: { clauseId, status, clauseName },
                bubbles: true,
                composed: true
            })
        );
    }

    getStatusClass(statusValue) {
        switch ((statusValue || "").trim()) {
            case "Enforced":
                return "clp-status clp-status_enforced";
            case "Suspended":
                return "clp-status clp-status_suspended";
            case "Approved":
                return "clp-status clp-status_approved";
            case "In Review":
                return "clp-status clp-status_inreview";
            case "Draft":
                return "clp-status clp-status_draft";
            case "Obsolete":
                return "clp-status clp-status_obsolete";
            default:
                return "clp-status";
        }
    }

    injectStatusStyles() {
        const STYLE_ID = "clp-status-colors";
        if (document.getElementById(STYLE_ID)) {
            return;
        }

        const styleEl = document.createElement("style");
        styleEl.id = STYLE_ID;
        styleEl.textContent = `
            .clp-status { font-weight: 600 !important; }
            .clp-status_draft { color: #A9A9A9 !important; }
            .clp-status_approved { color: #1B96FF !important; }
            .clp-status_suspended { color: #E5A4A9 !important; }
            .clp-status_inreview { color: #F59D3D !important; }
            .clp-status_enforced { color: #2E844A !important; }
            .clp-status_obsolete { color: #C9C7C5 !important; }
        `;
        document.head.appendChild(styleEl);
    }

    compareValues(a, b, direction) {
        const left = (a ?? "").toString().toLowerCase();
        const right = (b ?? "").toString().toLowerCase();

        if (left === right) {
            return 0;
        }

        const result = left > right ? 1 : -1;
        return direction === "desc" ? -result : result;
    }

    bindResizeListener() {
        if (this._resizeHandlerBound) {
            return;
        }

        window.addEventListener("resize", this.handleResize);
        this._resizeHandlerBound = true;
    }

    updateDynamicPageSize() {
        const tableWrap = this.template.querySelector(".clp__tableWrap");
        if (!tableWrap) {
            return;
        }

        const wrapHeight = Math.floor(tableWrap.getBoundingClientRect().height);
        if (wrapHeight <= 0) {
            return;
        }

        const availableHeight = Math.max(0, wrapHeight - TABLE_CHROME_HEIGHT);
        const calculatedRows = Math.floor(availableHeight / ESTIMATED_ROW_HEIGHT);
        const nextPageSize = Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, calculatedRows));

        if (nextPageSize !== this.pageSize) {
            this.pageSize = nextPageSize;
            this.currentPage = this.normalizedCurrentPage;
        }
    }
}
