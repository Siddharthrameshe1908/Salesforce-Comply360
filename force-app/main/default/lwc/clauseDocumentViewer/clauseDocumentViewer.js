import { LightningElement, api } from 'lwc';
import COMPLIANCE_DUMMY_PDF from '@salesforce/resourceUrl/ComplianceDummyDocument';

export default class ClauseDocumentViewer extends LightningElement {
    @api recordId;
    @api documentName;
    @api contentServerUrl;
    @api nodeId;

    documentTitle = 'Enterprise Security Policy and Guidelines';
    documentVersion = '2.4.1';
    documentDate = 'March 15, 2025';

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

    get pdfUrl() {
        return COMPLIANCE_DUMMY_PDF;
    }

    handleOpenInNewTab() {
        window.open(this.pdfUrl, '_blank');
    }

    handleDownload() {
        window.open(this.pdfUrl, '_blank');
    }
}