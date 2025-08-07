// ==UserScript==
// @name         YR.no - Yr Plus
// @namespace    https://github.com/turbosnute/
// @version      1.5.3
// @description  Navigate the yr.no navbar using `Ctrl` + `←`/`→`. Navigate to 21-day forecast, radar map or daily table view using `Ctrl` + `Shift` + `L`, `Ctrl` + `Shift` + `R` or `Ctrl` + `Shift`` + `V`. Show a menu to navigate through favorite locations with `Ctrl` + `Shift` + `F`. Search for new locations in the menu.
// @author       Øyvind Nilsen (on@ntnu.no)
// @match        https://www.yr.no/*
// @grant        none
// @run-at       document-end
// @icon         https://www.google.com/s2/favicons?sz=64&domain=yr.no
// @updateURL    https://raw.githubusercontent.com/turbosnute/yr-plus/main/yr.user.js
// @downloadURL  https://raw.githubusercontent.com/turbosnute/yr-plus/main/yr.user.js
// ==/UserScript==

(function() {
    'use strict';

    // Language Code
    let lang_code = 'en'; // Default language code
    if (typeof self.__LOCALE_CODE__ !== 'undefined' && self.__LOCALE_CODE__ !== null) {
        lang_code = self.__LOCALE_CODE__;
    }

    // Translations
    const translations = {
        "21-day-forecast": {
            "en": "21-day-forecast",
            "nb": "21-dagersvarsel",
            "nn": "21-dagarsvarsel",
            "sme": "21-beaivvedieđáhus"
        },
        "daily-table": {
            "en": "forecast/daily-table",
            "nb": "værvarsel/daglig-tabell",
            "nn": "vêrvarsel/dagleg-tabell",
            "sme": "dálkedieđáhus/beaivválaš-tabealla"
        },
        "radar": {
            "en": "map/radar",
            "nb": "kart/radar",
            "nn": "kart/radar",
            "sme": "kárta/rádár"
        },
        "myPlaces": {
            "en": "My locations",
            "nb": "Mine steder",
            "nn": "Mine stader",
            "sme": "Mu báikkit"
        },
        "search": {
            "en": "Search for location...",
            "nb": "Søk etter sted...",
            "nn": "Søk etter stad...",
            "sme": "Oza báikki..."
        },
        "searchEndpoint": {
            "en": "search?q=",
            "nb": "søk?q=",
            "nn": "søk?q=",
            "sme": "oza?q="
        }
    };

    // Create the menu element
    const menu = document.createElement('div');
    menu.id = 'location-favo-menu';
    menu.style.position = 'fixed';
    menu.style.top = '50%';
    menu.style.left = '50%';
    menu.style.transform = 'translate(-50%, -50%)';
    menu.style.backgroundColor = 'white';
    menu.style.border = '1px solid black';
    menu.style.borderRadius = '8px';
    menu.style.padding = '15px';
    menu.style.zIndex = '10000';
    menu.style.display = 'none';
    menu.style.transition = 'opacity 0.4s';
    menu.style.minWidth = '350px';
    menu.style.maxWidth = '500px';
    menu.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    document.body.appendChild(menu);

    // Variables to keep track of state
    let selectedIndex = 0;
    let isSearchFocused = false;
    let isMenuOpen = false; // Track if the menu is currently open
    let keysPressed = new Set(); // Track which keys are currently pressed

    // Function to get locations from localStorage
    /*
    function getLocationsFromStorage() {
        return {
            favorites: JSON.parse(localStorage.getItem('favouritedLocations') || '[]'),
            visited: JSON.parse(localStorage.getItem('visitedLocations') || '[]')
        };
    }
    */

    // Function to get locations from localStorage or API
    async function getLocationsFromStorage() {
        //console.log('[YR+] Getting locations from storage...');
        
        if (isUserLoggedIn()) {
            //console.log('[YR+] User is logged in, attempting to fetch from API...');
            try {
                const loginState = localStorage.getItem('nrk-login-client-state');
                const parsed = JSON.parse(loginState);
                const accessToken = parsed.sessionData.accessToken;
                
                //console.log('[YR+] Making API request to userdata endpoint...');
                const response = await fetch('https://www.yr.no/api/v0/userdata', {
                    method: 'GET',
                    headers: {
                        'Authorization': `${accessToken}`,
                        'Referer': `https://www.yr.no/${lang_code}`
                    }
                });
                
                //console.log('[YR+] API response status:', response.status);
                
                if (response.ok) {
                    const userData = await response.json();
                    //console.log('[YR+] API userData received:', userData);
                    
                    const apiData = {
                        favorites: userData.user?.locations?.favorites || [],
                        visited: userData.user?.locations?.visited || [],
                        username: parsed.sessionData.user?.name || ''
                    };
                    
                    //console.log('[YR+] Parsed API locations:', apiData);
                    return apiData;
                } else {
                    console.warn('[YR+] API request failed with status:', response.status);
                }
            } catch (error) {
                console.error('[YR+] Error fetching user data from API:', error);
                // Fall back to localStorage if API fails
            }
        } else {
            //console.log('[YR+] User not logged in, using localStorage...');
        }
        
        // Fallback to localStorage for non-logged in users or if API fails
        const localData = {
            favorites: JSON.parse(localStorage.getItem('favouritedLocations') || '[]'),
            visited: JSON.parse(localStorage.getItem('visitedLocations') || '[]'),
            username: ''
        };
        
        //console.log('[YR+] Using localStorage data:', localData);
        return localData;
    }

    // Function to create search input
    function createSearchInput() {
        const searchContainer = document.createElement('div');
        searchContainer.style.marginBottom = '15px';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.id = 'location-search-input';
        searchInput.placeholder = translations['search'][lang_code];
        searchInput.style.width = '100%';
        searchInput.style.padding = '8px 12px';
        searchInput.style.border = '1px solid #ccc';
        searchInput.style.borderRadius = '4px';
        searchInput.style.fontSize = '14px';
        searchInput.style.outline = 'none';
        searchInput.style.boxSizing = 'border-box';

        // Search input event handlers
        searchInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                const query = searchInput.value.trim();
                if (query) {
                    const searchEndpoint = translations['searchEndpoint'][lang_code];
                    const searchUrl = `https://www.yr.no/${lang_code}/${searchEndpoint}${encodeURIComponent(query)}`;
                    window.location.href = searchUrl;
                }
            } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                event.stopPropagation();
                const items = menu.querySelectorAll('li');
                if (items.length > 0) {
                    isSearchFocused = false;
                    selectedIndex = 0;
                    highlightSelected();
                    searchInput.blur();
                }
            } else if (event.key === 'Escape') {
                event.preventDefault();
                hideMenu();
            }
        });

        searchInput.addEventListener('focus', function() {
            isSearchFocused = true;
            // Clear selection from list items
            const items = menu.querySelectorAll('li');
            items.forEach(item => {
                item.style.backgroundColor = 'white';
            });
        });

        searchContainer.appendChild(searchInput);
        return searchContainer;
    }
    
    // Function to check if user is logged in
    function isUserLoggedIn() {
        const loginState = localStorage.getItem('nrk-login-client-state');
        if (!loginState) return false;
        
        try {
            const parsed = JSON.parse(loginState);
            // Check if token exists and hasn't expired
            return parsed && parsed.sessionData && parsed.sessionData.accessToken && 
                   parsed.expires > Date.now();
        } catch (e) {
            console.warn('Invalid login state format:', e);
            return false;
        }
    }

    // Function to show the menu
    async function showMenu() {
        //console.log('[YR+] showMenu called, isMenuOpen:', isMenuOpen);
        
        // Prevent multiple calls if menu is already being shown or is open
        if (isMenuOpen) return;
        
        isMenuOpen = true; // Set flag immediately to prevent duplicate calls
        //console.log('[YR+] Menu opening...');
        
        const locationData = await getLocationsFromStorage();
        //console.log('[YR+] Location data retrieved:', locationData);
        
        const { favorites, visited, username } = locationData;

        const user_label = username ? ` (${username})` : ''; 

        // Combine the two arrays and remove duplicates
        let combinedLocations = [...new Set([...favorites, ...visited])];
        //console.log('[YR+] Combined locations:', combinedLocations);

        // Create search input
        const searchContainer = createSearchInput();

        // Create locations list
        const locationsContainer = document.createElement('div');

        if (combinedLocations.length > 0) {
            //console.log('[YR+] Fetching location details for', combinedLocations.length, 'locations...');
            try {
                const locationPromises = combinedLocations.map(id => {
                    //console.log('[YR+] Fetching details for location ID:', id);
                    return fetch(`https://www.yr.no/api/v0/locations/${id}?language=${lang_code}`)
                        .then(response => {
                            //console.log('[YR+] Location API response for', id, ':', response.status);
                            return response.json();
                        })
                        .catch(error => {
                            console.error(`[YR+] Error fetching location ${id}:`, error);
                            return null;
                        });
                });
                
                const locations = await Promise.all(locationPromises);
                const validLocations = locations.filter(location => location !== null);
                //console.log('[YR+] Valid locations retrieved:', validLocations);
                

                locationsContainer.innerHTML = '<h3 class="header-3 heading--color-primary" style="margin-top: 0; margin-bottom: 10px;">' + translations['myPlaces'][lang_code] + user_label + '</h3><ul style="list-style: none; padding: 0; margin: 0;">' + validLocations.map((location, index) => `
                    <li data-id="${location.id}" data-index="${index}" style="padding: 8px 12px; cursor: pointer; border-radius: 4px;">
                        <span class="header-4 heading--color-primary weather-location-list-item__location-heading">${favorites.includes(location.id) ? '⭐' : '🕛'} ${location.name}</span>
                    </li>`).join('') + '</ul>';
                
                // Add click handlers for the list items
                const items = locationsContainer.querySelectorAll('li');
                items.forEach(item => {
                    item.addEventListener('click', function() {
                        const locationId = this.getAttribute('data-id');
                        const tablePath = translations['daily-table'][lang_code];
                        window.location.href = `https://www.yr.no/${lang_code}/${tablePath}/${locationId}/`;
                    });
                });
            } catch (error) {
                console.error('[YR+] Error fetching locations:', error);
                locationsContainer.innerHTML = '<h3 class="header-3 heading--color-primary" style="margin-top: 0; margin-bottom: 10px;">' + translations['myPlaces'][lang_code] + '</h3><p>Error loading locations</p>';
            }
        } else {
            //console.log('[YR+] No locations found');
            locationsContainer.innerHTML = '<h3 class="header-3 heading--color-primary" style="margin-top: 0; margin-bottom: 10px;">' + translations['myPlaces'][lang_code] + '</h3><p>No saved locations</p>';
        }

        // Clear menu and add components
        menu.innerHTML = '';
        menu.appendChild(searchContainer);
        menu.appendChild(locationsContainer);

        menu.style.display = 'block';
        menu.style.opacity = '1';

        // Focus search input and reset selection
        const searchInput = menu.querySelector('#location-search-input');
        searchInput.focus();
        isSearchFocused = true;
        selectedIndex = 0;
        
        //console.log('[YR+] Menu display completed');
    }

    // Function to hide the menu
    function hideMenu() {
        menu.style.opacity = '0';
        setTimeout(() => {
            menu.style.display = 'none';
            isMenuOpen = false; // Reset flag when menu is fully hidden
        }, 400);
        isSearchFocused = false;
    }

    // Function to highlight the selected item
    function highlightSelected() {
        const items = menu.querySelectorAll('li');
        items.forEach((item, index) => {
            item.style.backgroundColor = index === selectedIndex ? 'lightblue' : 'white';
        });
    }

    // Function to navigate to the next or previous menu item
    function navigateNavbar(direction) {
        const navbar = document.querySelector('#location-header__list');
        if (!navbar) return;

        const items = navbar.querySelectorAll('.location-header__menu-item');
        const activeItem = navbar.querySelector('.location-header__menu-item a[aria-current="page"]');
        let currentIndex = Array.from(items).indexOf(activeItem.parentElement);

        if (direction === 'left') {
            currentIndex = (currentIndex > 0) ? currentIndex - 1 : items.length - 1;
        } else if (direction === 'right') {
            currentIndex = (currentIndex < items.length - 1) ? currentIndex + 1 : 0;
        }

        if (currentIndex >= 0 && currentIndex < items.length) {
            const newActiveItem = items[currentIndex].querySelector('a');
            if (newActiveItem) {
                window.location.href = newActiveItem.href;
            }
        }
    }

    // Add event listener for keydown events
    document.addEventListener('keydown', function(event) {
        // Add the key to the set of pressed keys
        keysPressed.add(event.key);
        
        if (event.ctrlKey) {
            if (event.key === 'ArrowLeft') {
                navigateNavbar('left');
            } else if (event.key === 'ArrowRight') {
                navigateNavbar('right');
            } else if (event.shiftKey && event.key === 'F') {
                // Only trigger if this is the first time F is pressed while Ctrl+Shift are held
                if (!keysPressed.has('F') || keysPressed.size === 3) {
                    event.preventDefault(); // Prevent default behavior
                    showMenu();
                }
            } else if ((event.shiftKey) && (event.key === 'L' || event.key === 'R' || event.key === 'V')) {
                // Get the current URL
                const url = window.location.href;
                const pattern = /https:\/\/(?:www\.)?yr\.no\/([a-z]{2,3})\/(.+)\/([0-9-]+)\//;
                const match = url.match(pattern);
                var view = '';

                if (match) {
                    if (event.key === 'L') {
                        view = translations['21-day-forecast'][lang_code];
                    } else if (event.key === 'R') {
                        view = translations['radar'][lang_code];
                    } else if (event.key === 'V') {
                        view = translations['daily-table'][lang_code];
                    }

                    if (view) {
                        const newUrl = `https://www.yr.no/${lang_code}/${view}/${match[3]}/`;
                        window.location.href = newUrl;
                    }
                }
            }
        } else if (menu.style.display === 'block') {
            const items = menu.querySelectorAll('li');
            const searchInput = menu.querySelector('#location-search-input');

            if (event.key === 'Escape') {
                hideMenu();
            } else if (!isSearchFocused) {
                // Handle navigation in the location list
                if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    if (selectedIndex === 0) {
                        // Go back to search input
                        isSearchFocused = true;
                        searchInput.focus();
                        // Clear list selection
                        items.forEach(item => {
                            item.style.backgroundColor = 'white';
                        });
                    } else {
                        selectedIndex = selectedIndex - 1;
                        highlightSelected();
                    }
                } else if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    selectedIndex = (selectedIndex < items.length - 1) ? selectedIndex + 1 : 0;
                    highlightSelected();
                } else if (event.key === 'Enter') {
                    event.preventDefault();
                    if (items.length > 0 && selectedIndex >= 0 && selectedIndex < items.length) {
                        const selectedItem = items[selectedIndex];
                        const locationId = selectedItem.getAttribute('data-id');
                        var tablePath = translations['daily-table'][lang_code];
                        window.location.href = `https://www.yr.no/${lang_code}/${tablePath}/${locationId}/`;
                    }
                }
            }
        }
    });
    // Add event listener for keyup events to track when keys are released
    document.addEventListener('keyup', function(event) {
        keysPressed.delete(event.key);
    });
    // Add event listener to close the menu when clicking outside of it
    document.addEventListener('click', function(event) {
        const menu = document.querySelector('#location-favo-menu');
        if (menu && !menu.contains(event.target)) {
            hideMenu();
        }
    });
})();

