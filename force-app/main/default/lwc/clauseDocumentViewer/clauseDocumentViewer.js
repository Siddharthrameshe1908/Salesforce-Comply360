import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import getDocumentsForVersion from '@salesforce/apex/ClauseDocumentService.getDocumentsForVersion';

const VERSION_FIELD = 'devcomply360__Clause__c.devcomply360__Version__c';
const TAB_ORDER = ['Compliance', 'Procedure', 'Work Instructions'];

export default class ClauseDocumentViewer extends LightningElement {
    _clauseId;

    @api recordId;
    @api documentName;
    @api contentServerUrl;
    @api nodeId;

    selectedVersion;
    activeTab = 'Compliance';
    isLoading = false;
    isFrameLoading = false;
    loadError;
    documentsByType = {};

    @api
    get clauseId() {
        return this._clauseId;
    }

    set clauseId(value) {
        this._clauseId = value;
        if (!value) {
            this.selectedVersion = undefined;
            this.isLoading = false;
            this.isFrameLoading = false;
            this.clearDocuments();
        }
    }

    bookmarks = [
        { id: '1', label: 'Introduction', page: '1', className: 'doc-viewer__bookmark' },
        { id: '2', label: 'Policy Overview', page: '2', className: 'doc-viewer__bookmark doc-viewer__bookmark--active' },
        { id: '3', label: 'Access Control', page: '3', className: 'doc-viewer__bookmark doc-viewer__bookmark--child' },
        { id: '4', label: 'Data Classification', page: '5', className: 'doc-viewer__bookmark doc-viewer__bookmark--child' },
        { id: '5', label: 'Incident Response', page: '7', className: 'doc-viewer__bookmark' },
        { id: '6', label: 'Security Awareness', page: '9', className: 'doc-viewer__bookmark' },
        { id: '7', label: 'Third-Party Risk', page: '11', className: 'doc-viewer__bookmark' },
        { id: '8', label: 'Implementation Guidelines', page: '13', className: 'doc-viewer__bookmark' },
        { id: '9', label: 'Governance', page: '14', className: 'doc-viewer__bookmark' },
        { id: '10', label: 'Audit & Compliance', page: '18', className: 'doc-viewer__bookmark' }
    ];

    @wire(getRecord, { recordId: '$clauseId', fields: [VERSION_FIELD] })
    async wiredClause({ data, error }) {
        if (error) {
            this.selectedVersion = undefined;
            this.clearDocuments();
            this.loadError = 'Unable to load clause version.';
            return;
        }

        if (!data) {
            return;
        }

        const versionValue = getFieldValue(data, VERSION_FIELD);
        const normalizedVersion = versionValue ? String(versionValue) : '';

        if (!normalizedVersion) {
            this.selectedVersion = undefined;
            this.clearDocuments();
            return;
        }

        if (normalizedVersion === this.selectedVersion) {
            return;
        }

        this.selectedVersion = normalizedVersion;
        await this.loadVersionDocuments();
    }

    get tabItems() {
        return TAB_ORDER.map((tabLabel) => ({
            label: tabLabel,
            className:
                this.activeTab === tabLabel
                    ? 'doc-viewer__tab doc-viewer__tab--active'
                    : 'doc-viewer__tab'
        }));
    }

    get activeDocument() {
        return this.documentsByType[this.activeTab];
    }

    get activePdfUrl() {
        return this.activeDocument?.viewUrl || '';
    }

    get hasActiveDocument() {
        return Boolean(this.activeDocument?.viewUrl);
    }

    get documentTitle() {
        return this.activeDocument?.title || 'No document selected';
    }

    get documentVersion() {
        return this.selectedVersion || '-';
    }

    get documentDate() {
        if (!this.activeDocument?.lastModifiedDate) {
            return '-';
        }
        return new Date(this.activeDocument.lastModifiedDate).toLocaleDateString();
    }

    get showEmptyState() {
        return !this.isLoading && !this.hasActiveDocument;
    }

    get showFrameLoader() {
        return !this.isLoading && this.hasActiveDocument && this.isFrameLoading;
    }

    get iframeClass() {
        return this.isFrameLoading ? 'doc-viewer__iframe doc-viewer__iframe--loading' : 'doc-viewer__iframe';
    }

    get emptyStateMessage() {
        if (this.loadError) {
            return this.loadError;
        }
        if (!this.selectedVersion) {
            return 'No clause version selected.';
        }
        return `Version ${this.selectedVersion} is not uploaded for ${this.activeTab}.`;
    }

    handleTabClick(event) {
        this.activeTab = event.currentTarget.dataset.tab;
        this.isFrameLoading = this.hasActiveDocument;
    }

    handleIframeLoad() {
        this.isFrameLoading = false;
    }

    async loadVersionDocuments() {
        this.isLoading = true;
        this.isFrameLoading = false;
        this.loadError = undefined;
        this.documentsByType = {};

        try {
            const result = await getDocumentsForVersion({
                versionValue: this.selectedVersion
            });

            const mapped = {};
            (result || []).forEach((doc) => {
                if (doc?.documentType) {
                    mapped[doc.documentType] = doc;
                }
            });
            this.documentsByType = mapped;

            if (!mapped[this.activeTab]) {
                const firstAvailableTab = TAB_ORDER.find((tabLabel) => Boolean(mapped[tabLabel]));
                this.activeTab = firstAvailableTab || TAB_ORDER[0];
            }

            this.isFrameLoading = this.hasActiveDocument;
        } catch (err) {
            this.loadError = err?.body?.message || 'Unable to fetch document mappings.';
            this.isFrameLoading = false;
        } finally {
            this.isLoading = false;
        }
    }

    clearDocuments() {
        this.documentsByType = {};
        this.activeTab = TAB_ORDER[0];
        this.loadError = undefined;
        this.isFrameLoading = false;
    }

    handleOpenInNewTab() {
        if (!this.hasActiveDocument) {
            return;
        }
        window.open(this.activePdfUrl, '_blank');
    }

    handleDownload() {
        if (!this.hasActiveDocument) {
            return;
        }
        window.open(this.activeDocument.downloadUrl, '_blank');
    }
}
