
export function useImportGoogleMap({ showLoading, onLoad = () => {}, onError = () => {} }) {
    showLoading = showLoading || false;
    const rpc = useService('rpc');
    const user = useService('user');
    const ui = useService('ui');

    onWillStart(loadGoogleLoader);

    function prepareOptions(settings) {
        const loaderOptions = {
            key: settings.api_key,
            v: settings.version,
            libraries: settings.libraries,
        };
        if (settings.region) {
            loaderOptions.region = settings.region;
        }
        if (settings.language) {
            loaderOptions.language = settings.language;
        }
        return loaderOptions;
    }

    async function loadGoogleLoader() {
        try {
            showLoading && ui.block();
            const data = await rpc('/web/base_google_map/settings', {
                context: user.context,
            });
            if (data) {
                const settings = { ...data };
                const loaderOptions = prepareOptions(settings);
                const script = document.createElement('script');
                script.type = 'text/javascript';
                script.textContent = `
                (g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=https://maps.${c}apis.com/maps/api/js?+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})(JSON.parse('${JSON.stringify(loaderOptions)});
                `;
                document.head.appendChild(script);
                // try {
                //     const loader = new google.maps.plugins.loader.Loader(loaderOptions);
                //     loader
                //         .load()
                //         .then((_google) => {
                //             showLoading && ui.unblock();
                //             window.google = _google;
                //             delete settings.api_key;
                //             delete settings.version;
                //             onLoad(settings);
                //         })
                //         .catch((e) => {
                //             showLoading && ui.unblock();
                //             console.error(e);
                //             onError(e);
                //         });
                // } catch (error) {
                //     showLoading && ui.unblock();
                //     console.error(error);
                //     onError(error);
                // }
            }
        } catch (error) {
            showLoading && ui.unblock();
            console.error(error);
            onError(error);
        }
    }

    async function importLibrary(library) {
        try {
            const google = await new Promise((resolve) => {
                window.google.importLibrary(library, resolve);
            });
            return google;
        } catch (error) {
            console.error(error);
        }
    }

    return {
        importLibrary
    }
}