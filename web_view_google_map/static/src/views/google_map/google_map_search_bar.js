import { useService } from '@web/core/utils/hooks';
import { _t } from '@web/core/l10n/translation';
import { SearchBarMenu } from '@web/search/search_bar_menu/search_bar_menu';
import { SearchBar } from '@web/search/search_bar/search_bar';

export class GoogleMapSearchBarMenu extends SearchBarMenu {
    /**
     * @override
     */
    setup() {
        super.setup();
        this.notificationService = useService('notification');
    }

    /**
     * @override
     * Blocks activation of a second group-by before the search model is updated,
     * keeping the map view's single-group constraint enforced at the UI layer.
     */
    onGroupBySelected(item) {
        if (!item.isActive && this.groupByItems.some((v) => v.isActive)) {
            this.notificationService.add(_t('You can only have one active group at a time.'), { type: 'warning' });
            return;
        }
        super.onGroupBySelected(item);
    }
}

/** Replaces the default SearchBarMenu with GoogleMapSearchBarMenu to enforce single group-by. */
export class GoogleMapSearchBar extends SearchBar {
    static components = {
        ...SearchBar.components,
        SearchBarMenu: GoogleMapSearchBarMenu,
    };
}
