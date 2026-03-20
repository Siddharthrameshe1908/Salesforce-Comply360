import { LightningElement, api } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import chartJs from '@salesforce/resourceUrl/chartJs';

const STATUS_COLOR_MAP = {
    Draft: '#A9A9A9',
    Approved: '#1B96FF',
    Suspended: '#E5A4A9',
    'In Review': '#F59D3D',
    Enforced: '#2E844A',
    Obsolete: '#C9C7C5'
};

export default class ComplianceClauseStatus extends LightningElement {
    @api totalClauses = 0;
    @api statusItems = [];

    chart;
    chartJsInitialized = false;
    hasRendered = false;

    renderedCallback() {
        if (this.hasRendered) {
            this.renderChart();
            return;
        }

        this.hasRendered = true;

        loadScript(this, chartJs + '/chart.umd.min.js')
            .then(() => {
                this.chartJsInitialized = true;
                this.renderChart();
            })
            .catch((error) => {
                // eslint-disable-next-line no-console
                console.error('Chart.js load failed', error);
            });
    }

    renderChart() {
        if (!this.chartJsInitialized || !this.statusItems) {
            return;
        }

        const canvas = this.template.querySelector('canvas.statusChart');
        if (!canvas) {
            return;
        }

        const labels = this.statusItems.map((item) => item.status);
        let data = this.statusItems.map((item) => Number(item.count) || 0);
        let backgroundColors = labels.map(
            (label) => STATUS_COLOR_MAP[label] || '#C9C7C5'
        );

        const total = data.reduce((sum, value) => sum + value, 0);

        if (total === 0) {
            data = [1];
            backgroundColors = ['#D8DDE6'];
        }

        if (this.chart) {
            this.chart.destroy();
        }

        const Chart = window.Chart;
        this.chart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [
                    {
                        data,
                        backgroundColor: backgroundColors,
                        borderColor: '#FFFFFF',
                        borderWidth: 2,
                        hoverOffset: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                animation: {
                    duration: 350
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: total > 0
                    }
                }
            }
        });
    }

    get statusItemsForLegend() {
        return (this.statusItems || []).map((item) => {
            return {
                ...item,
                dotClass: `legend-dot ${this.getStatusDotClass(item.status)}`,
                pillClass: `status-pill ${this.getStatusPillClass(item.status)}`
            };
        });
    }

    getStatusDotClass(status) {
        switch (status) {
            case 'Draft':
                return 'legend-dot_draft';
            case 'Approved':
                return 'legend-dot_approved';
            case 'Suspended':
                return 'legend-dot_suspended';
            case 'In Review':
                return 'legend-dot_inreview';
            case 'Enforced':
                return 'legend-dot_enforced';
            case 'Obsolete':
                return 'legend-dot_obsolete';
            default:
                return 'legend-dot_default';
        }
    }

    getStatusPillClass(status) {
        switch (status) {
            case 'Draft':
                return 'status-pill_draft';
            case 'Approved':
                return 'status-pill_approved';
            case 'Suspended':
                return 'status-pill_suspended';
            case 'In Review':
                return 'status-pill_inreview';
            case 'Enforced':
                return 'status-pill_enforced';
            case 'Obsolete':
                return 'status-pill_obsolete';
            default:
                return 'status-pill_default';
        }
    }
}