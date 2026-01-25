import { _t } from '@web/core/l10n/translation';
import { ConfirmationDialog } from '@web/core/confirmation_dialog/confirmation_dialog';
import { useService } from '@web/core/utils/hooks';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export class UploadGeoJsonFileDialog extends ConfirmationDialog {
    static template = 'web_view_google_map_drawing.UploadGeoJsonFileDialog';
    static props = {
        ...ConfirmationDialog.props,
        confirm: Function,
    };

    static defaultProps = {
        ...ConfirmationDialog.defaultProps,
        title: _t('Import GeoJSON File'),
        confirmLabel: _t('Apply'),
    };

    setup() {
        super.setup();
        this.notificationService = useService('notification');
    }

    async _confirm() {
        // Validate user has uploaded a file and that it is within the size limit
        const fileInput = this.modalRef.el.querySelector('#geojson-file');
        if (fileInput.files.length === 0) {
            // Notify the user that no file was selected
            this.notificationService.add(
                _t('Please upload your GeoJSON file'),
                { type: 'danger' }
            );
            // Do not proceed with the confirmation
            return;
        }
        const file = fileInput.files[0];
        if (file.size > MAX_FILE_SIZE) {
            // Notify the user that the file is too large
            this.notificationService.add(
                _t('File size exceeds the maximum allowed size of 5MB'),
                { type: 'danger' }
            );
            // Reset the file input
            fileInput.value = '';
            // Do not proceed with the confirmation
            return;
        }
        if (!this._validateFile(file)) {
            // Notify the user that the file type is invalid
            this.notificationService.add(
                _t('Invalid file type. Please upload a valid GeoJSON file.'),
                { type: 'danger' }
            );
            // Reset the file input
            fileInput.value = '';
            // Do not proceed with the confirmation
            return;
        }
        return this.execButton(this.props.confirm, file);
    }

    async execButton(callback, file) {
        if (this.isProcess) {
            return;
        }
        this.setButtonsDisabled(true);
        if (callback) {
            let shouldClose;
            try {
                shouldClose = await callback(file);
            } catch (e) {
                this.props.close();
                throw e;
            }
            if (shouldClose === false) {
                this.setButtonsDisabled(false);
                return;
            }
        }
        this.props.close();
    }

    /**
     * Validates if the uploaded file is a GeoJSON or JSON file based on its MIME type and extension.
     * Note: we don't check the content of the file here.
     * @param {*} file
     * @returns {boolean} True if the file is a valid GeoJSON or JSON file, false otherwise
     */
    _validateFile(file) {
        const validTypes = ['application/geo+json', 'application/json'];
        const validExtensions = ['.geojson', '.json'];

        // Check MIME type first
        if (validTypes.includes(file.type)) {
            return true;
        }

        // Fallback to extension check (file.type can be empty)
        const fileName = file.name.toLowerCase();
        return validExtensions.some((ext) => fileName.endsWith(ext));
    }
}
