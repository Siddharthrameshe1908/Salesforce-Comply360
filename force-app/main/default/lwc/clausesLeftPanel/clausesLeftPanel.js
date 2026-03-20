import { LightningElement, api, track, wire } from "lwc";
import { refreshApex } from '@salesforce/apex';
import getClauseCards from "@salesforce/apex/devcomply360_ClausesController.getClauseCards";

const ALL = "ALL";
const EMPTY_FILTERS = () => ({ risk: ALL, status: ALL, domain: ALL, reviewer: ALL, type: ALL });

export default class ClausesLeftPanel extends LightningElement {
    @api recordId;

    pageSize = 6;
    visibleCount = 6;
    searchText = "";
    isPopoverOpen = false;

    @track clauses = [];
    @track selectedClauseId;
    @track filters = EMPTY_FILTERS();
    @track draft = EMPTY_FILTERS();

    _wiredResult;

    @wire(getClauseCards, { complianceId: "$recordId" })
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
                industryDomain: c.industryDomain || "",
                reviewer: c.reviewer || "",
                type: c.type || "",
                documentName: c.documentName || ""
            }));
            if (!this.selectedClauseId && this.clauses.length) {
                this.selectedClauseId = this.clauses[0].clauseId;
                this.dispatchClauseSelect(this.clauses[0].clauseId, this.clauses[0].status);
            }
        } else if (error) {
            this.clauses = [];
        }
    }

    @api refresh() {
        refreshApex(this._wiredResult);
    }

    connectedCallback() {
        this.setPageSizeByViewport();
        window.addEventListener("resize", this.handleResize);
    }

    disconnectedCallback() {
        window.removeEventListener("resize", this.handleResize);
    }

    handleResize = () => {
        const prev = this.pageSize;
        this.setPageSizeByViewport();
        if (prev !== this.pageSize) this.visibleCount = this.pageSize;
    };

    setPageSizeByViewport() {
        const w = window.innerWidth;
        this.pageSize = w <= 480 ? 4 : w <= 1024 ? 5 : 6;
        this.visibleCount = Math.max(this.visibleCount, this.pageSize);
    }

    // ── Popover ───────────────────────────────────────────────────
    toggleFilterPopover = () => {
        this.isPopoverOpen = !this.isPopoverOpen;
        if (this.isPopoverOpen) this.draft = { ...this.filters };
    };

    applyFilters = () => {
        this.filters = { ...this.draft };
        this.isPopoverOpen = false;
        this.visibleCount = this.pageSize;
    };

    clearDraft = () => {
        this.draft = EMPTY_FILTERS();
    };

    // ── Draft handlers (inside popover) ──────────────────────────
    handleDraftRisk     = (e) => { this.draft = { ...this.draft, risk: e.detail.value }; };
    handleDraftStatus   = (e) => { this.draft = { ...this.draft, status: e.detail.value }; };
    handleDraftDomain   = (e) => { this.draft = { ...this.draft, domain: e.detail.value }; };
    handleDraftReviewer = (e) => { this.draft = { ...this.draft, reviewer: e.detail.value }; };
    handleDraftType     = (e) => { this.draft = { ...this.draft, type: e.detail.value }; };

    // ── Active chips ──────────────────────────────────────────────
    get activeChips() {
        const f = this.filters;
        const chips = [];
        if (f.risk !== ALL)     chips.push({ key: "risk",     label: `Risk: ${f.risk}` });
        if (f.status !== ALL)   chips.push({ key: "status",   label: `Status: ${f.status}` });
        if (f.domain !== ALL)   chips.push({ key: "domain",   label: `Domain: ${f.domain}` });
        if (f.reviewer !== ALL) chips.push({ key: "reviewer", label: `Reviewer: ${f.reviewer}` });
        if (f.type !== ALL)     chips.push({ key: "type",     label: `Type: ${f.type}` });
        return chips;
    }

    get hasActiveFilters() { return this.activeChips.length > 0; }
    get activeFilterCount() { return this.activeChips.length || null; }
    get filterBtnVariant() { return this.hasActiveFilters ? "brand" : "border-filled"; }

    removeChip = (e) => {
        const key = e.currentTarget.dataset.key;
        this.filters = { ...this.filters, [key]: ALL };
        this.visibleCount = this.pageSize;
    };

    // ── Combobox options ──────────────────────────────────────────
    get riskComboOptions()     { return this.makeOpts(["Low","Medium","High","Critical"], (c) => c.riskLevel); }
    get statusComboOptions()   { return this.makeOpts(["Pending","Review","Approved","Rejected","Modified & Approved"], (c) => c.status); }
    get domainComboOptions()   { return this.makeOpts(["Energy","Environmental","Healthcare","Information Technology","Manufacturing"], (c) => c.industryDomain); }
    get reviewerComboOptions() { return this.makeOpts(["Susan","Michael","John"], (c) => c.reviewer); }
    get typeComboOptions()     { return this.makeOpts(["3 Months","6 Months","1 Year","One-Time (No Recurrence)"], (c) => c.type); }

    makeOpts(values, fn) {
        const counts = new Map();
        for (const c of this.clauses) { const k = fn(c) || ""; counts.set(k, (counts.get(k) || 0) + 1); }
        return [
            { label: "All", value: ALL },
            ...values.map((v) => ({ label: `${v} (${counts.get(v) || 0})`, value: v }))
        ];
    }

    // ── Filtering ─────────────────────────────────────────────────
    get filteredClauses() {
        const s = (this.searchText || "").trim().toLowerCase();
        const f = this.filters;
        return this.clauses
            .filter((c) => {
                if (f.risk !== ALL && c.riskLevel !== f.risk) return false;
                if (f.status !== ALL && c.status !== f.status) return false;
                if (f.domain !== ALL && c.industryDomain !== f.domain) return false;
                if (f.reviewer !== ALL && c.reviewer !== f.reviewer) return false;
                if (f.type !== ALL && c.type !== f.type) return false;
                if (s && !`${c.clauseName} ${c.clauseNumber} ${c.clauseId} ${c.documentName} ${c.reviewer}`.toLowerCase().includes(s)) return false;
                return true;
            })
            .map((c) => ({
                ...c,
                _tileClass: `clp-tile${this.selectedClauseId === c.clauseId ? " clp-tile--selected" : ""}`,
                _riskDotClass: `clp-dot clp-dot--${(c.riskLevel || "").toLowerCase()}`,
                _riskBadgeClass: this.riskBadgeClass(c.riskLevel),
                _statusBadgeClass: this.statusBadgeClass(c.status)
            }));
    }

    get visibleClauses()  { return this.filteredClauses.slice(0, this.visibleCount); }
    get filteredCount()   { return this.filteredClauses.length; }
    get totalCount()      { return this.clauses.length || null; }
    get showMoreVisible() { return this.filteredClauses.length > this.visibleCount; }
    get noResults()       { return this.filteredClauses.length === 0; }

    // ── Search ────────────────────────────────────────────────────
    handleSearch = (e) => { this.searchText = e.target.value; this.visibleCount = this.pageSize; };

    // ── Show more ─────────────────────────────────────────────────
    handleShowMore = () => { this.visibleCount = Math.min(this.visibleCount + this.pageSize, this.filteredClauses.length); };

    // ── Clause click ──────────────────────────────────────────────
    handleClauseClick = (e) => {
        const id = e.currentTarget.dataset.id;
        this.selectedClauseId = id;
        this.isPopoverOpen = false;
        const clause = this.clauses.find(c => c.clauseId === id);
        this.dispatchClauseSelect(id, clause?.status);
    };

    dispatchClauseSelect(clauseId, status) {
        this.dispatchEvent(new CustomEvent("clauseselect", { detail: { clauseId, status }, bubbles: true, composed: true }));
    }

    // ── Badge helpers ─────────────────────────────────────────────
    statusBadgeClass(status) {
        switch (status) {
            case "Approved":
            case "Modified & Approved": return "slds-badge clp-badge clp-badge--success";
            case "Rejected":            return "slds-badge clp-badge clp-badge--error";
            case "Review":              return "slds-badge clp-badge clp-badge--warning";
            default:                    return "slds-badge clp-badge clp-badge--neutral";
        }
    }

    riskBadgeClass(risk) {
        switch (risk) {
            case "Low":      return "slds-badge clp-badge clp-badge--success";
            case "Medium":   return "slds-badge clp-badge clp-badge--warning";
            case "High":     return "slds-badge clp-badge clp-badge--orange";
            case "Critical": return "slds-badge clp-badge clp-badge--error";
            default:         return "slds-badge clp-badge";
        }
    }
}