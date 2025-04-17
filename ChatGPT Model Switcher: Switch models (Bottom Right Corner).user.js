// ==UserScript==
// @name         ChatGPT Model Switcher: Switch models (Bottom Right Corner)
// @description  Injects a dropdown allowing you to switch LLMs during the chat.
// @namespace    http://github.com/c0des1ayr
// @author       c0des1ayr (modified by ALEXjma with the help of AI [gemini-2.5-pro-preview-03-25])
// @license      MIT
// @version      1.1.0
// @match        *://chatgpt.com/*
// @icon         https://chatgpt.com/favicon.ico
// @grant        unsafeWindow
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM.xmlHttpRequest
// @connect      api.github.com
// @run-at       document-idle
// ==/UserScript==

(async function() {
    'use strict';
    /**
     * Fetches a JSON file from a GitHub pre-release.
     * @returns {Promise<Object>} - A promise that resolves to the JSON list of models.
     */
    function getModels() {
        return new Promise((resolve, reject) => {
            const releasesUrl = `https://api.github.com/repos/ALEXjma/openai-models-list/releases`;

            GM.xmlHttpRequest({
                method: 'GET',
                url: releasesUrl,
                onload: function(response) {
                    if (response.status === 200) {
                        const releases = JSON.parse(response.responseText);
                        const release = releases.find(r => r.tag_name === "continuous" && r.prerelease);
                        if (release) {
                            const asset = release.assets.find(a => a.name === "models.json");
                            if (asset) {
                                GM.xmlHttpRequest({
                                    method: 'GET',
                                    url: asset.browser_download_url,
                                    onload: function(assetResponse) {
                                        if (assetResponse.status === 200) {
                                            try {
                                                const data = JSON.parse(assetResponse.responseText);
                                                resolve(data);
                                            } catch (e) {
                                                reject('Error parsing JSON data: ' + e);
                                            }
                                        } else {
                                            reject('Failed to download asset: ' + assetResponse.status);
                                        }
                                    },
                                    onerror: function() {
                                        reject('Error downloading asset');
                                    }
                                });
                            } else {
                                reject('Asset "models.json" not found in the release');
                            }
                        } else {
                            reject('Release "continuous" not found');
                        }
                    } else {
                        reject('Failed to fetch releases: ' + response.status);
                    }
                },
                onerror: function() {
                    reject('Error fetching releases');
                }
            });
        });
    }

    class ModelSwitcher {
        constructor(useOther = "Original", models) {
            this.useOther = useOther;
            this.models = models;
            this.debugPrefix = "[ModelSwitcher DEBUG]";
        }

        hookFetch() {
            const originalFetch = unsafeWindow.fetch;
            const self = this;

            unsafeWindow.fetch = async (resource, config = {}) => {
                const logPrefix = self.debugPrefix;

                const isTargetRequest = typeof resource === 'string' &&
                                        (resource.includes('/backend-api/conversation') || resource.includes('/backend-api/f/conversation')) &&
                                        config.method === 'POST' &&
                                        config.headers &&
                                        config.headers['Content-Type'] === 'application/json' &&
                                        config.body;


                if (isTargetRequest) {
                    console.log(`${logPrefix} Intercepted TARGET request:`, { resource: resource?.toString(), method: config?.method });
                    console.log(`${logPrefix} Current selected model setting: ${self.useOther}`);

                    if (self.useOther !== "Original") {
                        console.log(`${logPrefix} Attempting to modify model.`);
                        console.log(`${logPrefix} Original request body (string):`, config.body);

                        try {
                            const body = JSON.parse(config.body);
                            console.log(`${logPrefix} Parsed request body (object):`, body);

                            if (body.model !== undefined) {
                                console.log(`${logPrefix} 'model' key found. Original value: '${body.model}'`);
                                console.log(`${logPrefix} Setting model to: '${self.useOther}'`);
                                body.model = self.useOther;
                                console.log(`${logPrefix} Modified body (object):`, body);

                                config.body = JSON.stringify(body);
                                console.log(`${logPrefix} Modified body (stringified):`, config.body);
                            } else {
                                console.log(`${logPrefix} 'model' key not found in body. No modification performed.`);
                            }
                        } catch (e) {
                            console.error(`${logPrefix} Error processing request body:`, e);
                            console.warn(`${logPrefix} Proceeding with potentially unmodified request body due to error.`);
                        }
                    } else {
                        console.log(`${logPrefix} Model set to 'Original'. No modification needed.`);
                    }
                     console.log(`${logPrefix} Proceeding with target fetch call.`);
                }

                return originalFetch(resource, config);
            };
            console.log("[ModelSwitcher] Fetch hook applied.");
        }

        injectDropdownStyle() {
            if (!document.getElementById('modelSwitcherDropdownCss')) {
                const styleNode = document.createElement('style');
                styleNode.id = 'modelSwitcherDropdownCss';
                styleNode.type = 'text/css';
                // --- CSS for Bottom Right Corner ---
                styleNode.textContent = `
                #cb-dropdown {
                    position: fixed; /* Keep it fixed relative to the viewport */
                    bottom: 10px;      /* Distance from bottom */
                    right: 10px;     /* Distance from right */
                    z-index: 9999;  /* Ensure it's above most other elements */
                    width: auto;   /* Adjust width automatically */
                    min-width: 120px; /* Minimum width for readability */
                    padding: 5px 8px; /* Add some padding */
                    border-radius: 6px; /* Slightly rounded corners */
                    background-color: var(--dropdown-bg-color, #ccc);
                    color: var(--dropdown-text-color, #000);
                    border: 1px solid #666;
                    font-size: 0.8rem; /* Adjust font size if needed */
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2); /* Optional shadow */
                    opacity: 0.85; /* Slightly transparent */
                    transition: opacity 0.2s ease-in-out; /* Fade effect on hover */
                }
                #cb-dropdown:hover {
                    opacity: 1; /* Fully opaque on hover */
                }
                /* Dark Mode */
                @media (prefers-color-scheme: dark) {
                    #cb-dropdown {
                        --dropdown-bg-color: #2a2a2a; /* Darker background */
                        --dropdown-text-color: #e0e0e0; /* Lighter text */
                        border: 1px solid #555;
                    }
                }
                /* Light Mode */
                @media (prefers-color-scheme: light) {
                    #cb-dropdown {
                        --dropdown-bg-color: #f0f0f0; /* Lighter background */
                        --dropdown-text-color: #333;  /* Darker text */
                        border: 1px solid #ccc;
                    }
                }
                /* Style for the options within the dropdown */
                #cb-dropdown option {
                     background-color: var(--dropdown-bg-color, #ccc);
                     color: var(--dropdown-text-color, #000);
                }`;
                document.head.appendChild(styleNode);
                 console.log("[ModelSwitcher] Dropdown styles injected.");
            }
        }

        injectDropdown() {
             console.log('[ModelSwitcher] Attempting to inject dropdown...');
            if (document.getElementById('cb-dropdown')) {
                console.log('[ModelSwitcher] Dropdown already exists.');
                return;
            }

            const dropdown = document.createElement('select');
            dropdown.id = 'cb-dropdown';
            // className 'dropdown' is no longer strictly needed with ID styling, but keep for clarity
            dropdown.className = 'dropdown';

            // Add "Original" option
            const originalOption = document.createElement('option');
            originalOption.value = "Original"; // Use text as value for consistency
            originalOption.text = "Original";
            dropdown.options.add(originalOption);

            // Add combined models as options
            this.models.forEach(modelName => {
                let option = document.createElement('option');
                option.value = modelName;
                option.text = modelName;
                dropdown.options.add(option);
            });

            // Select the previously saved or default model
            dropdown.value = this.useOther;

            // Add event listener for changes
            dropdown.addEventListener('change', async () => {
                this.useOther = dropdown.value;
                console.log('[ModelSwitcher] Model changed to:', this.useOther);
                await GM.setValue('useOther', this.useOther);
            }, false);

            // Append the dropdown to the body
            document.body.appendChild(dropdown);
            console.log('[ModelSwitcher] Dropdown injected into body.');
        }

    }

    // --- Main Execution ---
    (async () => {
        console.log("[ModelSwitcher] Script starting...");

        // --- Load Custom Models from LocalStorage ---
        let customModels = [];
        const localStorageKey = 'modelSwitcherCustomModels';
        try {
            const storedModelsJson = localStorage.getItem(localStorageKey);
            if (storedModelsJson) {
                console.log(`[ModelSwitcher] Found custom models in localStorage ('${localStorageKey}'). Attempting to parse...`);
                const parsedModels = JSON.parse(storedModelsJson);
                if (Array.isArray(parsedModels)) {
                    // Filter out any non-string values just in case
                    customModels = parsedModels.filter(item => typeof item === 'string');
                    console.log("[ModelSwitcher] Successfully loaded custom models from localStorage:", customModels);
                } else {
                    console.warn(`[ModelSwitcher] Value in localStorage key '${localStorageKey}' is not an array. Ignoring.`);
                }
            } else {
                console.log(`[ModelSwitcher] No custom models found in localStorage key '${localStorageKey}'.`);
                // You can add a default list here if desired when none is found
                // customModels = ["default-custom-model-1"];
            }
        } catch (error) {
            console.error(`[ModelSwitcher] Error parsing custom models from localStorage key '${localStorageKey}'. Please ensure it's a valid JSON array string. Error:`, error);
            // customModels remains []
        }
        /*
         * --- HOW TO SET CUSTOM MODELS ---
         * Open your browser's Developer Console (usually F12).
         * Go to the 'Console' tab.
         * Paste and run a command like this (modify the list as needed):
         * localStorage.setItem('modelSwitcherCustomModels', JSON.stringify(["o3-mini", "gpt-4-turbo-preview", "your-custom-model"]));
         * To clear them, run:
         * localStorage.removeItem('modelSwitcherCustomModels');
         * Reload the ChatGPT page for changes to take effect.
        */

        // 1. Get the saved model preference or default to "Original"
        const useOther = await GM.getValue('useOther', "Original");
        console.log(`[ModelSwitcher] Initial model setting: ${useOther}`);

        // 2. Fetch the dynamic list of models
        let fetchedModels = [];
        try {
            console.log("[ModelSwitcher] Fetching dynamic models list...");
            const oai = await getModels(); // oai = { models: [...] }
            // Ensure the response structure is correct before accessing .models
            if (oai && Array.isArray(oai.models)) {
                fetchedModels = oai.models;
                console.log("[ModelSwitcher] Dynamic models fetched successfully:", fetchedModels);
            } else {
                 // Handle cases where the structure is wrong or models array is missing
                 console.warn("[ModelSwitcher] Fetched data is not in the expected format or models array is missing. Using only hardcoded models.");
                 // fetchedModels remains empty [] in this case
            }
        } catch (error) {
            // Log error but continue with hardcoded models if fetching fails
            console.error('[ModelSwitcher] Error fetching dynamic models list. Error:', error);
            // No alert needed here, as we can potentially still function with hardcoded ones
            // fetchedModels remains empty []
        }

        // 3. Combine custom (localStorage) and fetched models (custom first)
        // Use Set to remove duplicates, favoring custom models if names overlap
        const combinedModelNames = new Set([...customModels, ...fetchedModels]);
        const allModels = Array.from(combinedModelNames);
        console.log("[ModelSwitcher] Combined models list for dropdown (Custom + Fetched, unique):", allModels);

        // Check if there are any models to show besides "Original"
        if (allModels.length === 0) {
             console.warn("[ModelSwitcher] No models available (neither custom nor fetched). Dropdown will only show 'Original'.");
        }

        // 4. Create the ModelSwitcher instance with the combined list
        const switcher = new ModelSwitcher(useOther, allModels);

        // 5. Inject the necessary CSS styles
        switcher.injectDropdownStyle();

        // 6. Hook into the fetch requests
        switcher.hookFetch();

        // 7. Inject the dropdown element into the page body
        switcher.injectDropdown();

         console.log("[ModelSwitcher] Initialization complete.");

    })();

})();
