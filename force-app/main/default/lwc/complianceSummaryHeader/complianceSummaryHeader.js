import { LightningElement, api } from 'lwc';

export default class ComplianceSummaryHeader extends LightningElement {
    @api healthLabel;
    @api healthTheme;

    get bannerClass() {
        let themeClass = 'summary-banner';
        if (this.healthTheme === 'warning') {
            themeClass += ' summary-banner_warning';
        } else if (this.healthTheme === 'success') {
            themeClass += ' summary-banner_success';
        } else {
            themeClass += ' summary-banner_info';
        }
        return themeClass;
    }
}