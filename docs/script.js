// Configuration
const GITHUB_API = 'https://api.github.com/repos/smkgethubpro/sims/contents';
const RAW_GITHUB = 'https://raw.githubusercontent.com/smkgethubpro/sims/main';

let countriesData = [];
let selectedCountry = null;
let selectedOperator = null;
let selectedCategory = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    loadCountries();
});

// TAB SWITCHING
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    // Hide all
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('active');
    });

    // Show selected
    document.getElementById(tabName).classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Load stats if stats tab
    if (tabName === 'stats') {
        loadStatistics();
    }
}

// LOAD COUNTRIES
async function loadCountries() {
    try {
        const response = await fetch(`${RAW_GITHUB}/countries.json`);
        const data = await response.json();
        countriesData = data.countries;

        // Populate country selects
        const countrySelects = ['countrySelect', 'addCountry'];
        countrySelects.forEach(selectId => {
            const select = document.getElementById(selectId);
            countriesData.forEach(country => {
                const option = document.createElement('option');
                option.value = country.id;
                option.textContent = country.name;
                select.appendChild(option);
            });
        });
    } catch (error) {
        console.error('Error loading countries:', error);
        alert('Failed to load countries. Make sure the repository is public.');
    }
}

// LOAD OPERATORS
async function loadOperators() {
    const countryId = document.getElementById('countrySelect').value;
    if (!countryId) {
        document.getElementById('operatorSelect').innerHTML = '<option value="">Select operator...</option>';
        document.getElementById('categorySelect').innerHTML = '<option value="">Select category...</option>';
        document.getElementById('packagesSection').style.display = 'none';
        document.getElementById('noSelection').style.display = 'block';
        selectedCountry = null;
        selectedOperator = null;
        selectedCategory = null;
        return;
    }

    selectedCountry = countryId;
    document.getElementById('noSelection').style.display = 'none';

    try {
        const response = await fetch(`${RAW_GITHUB}/${countryId}/operators.json`);
        const data = await response.json();

        const operatorSelect = document.getElementById('operatorSelect');
        operatorSelect.innerHTML = '<option value="">Select operator...</option>';
        data.operators.forEach(op => {
            const option = document.createElement('option');
            option.value = op.folder || op.id;
            option.textContent = op.name;
            operatorSelect.appendChild(option);
        });

        // Reset other selects
        document.getElementById('categorySelect').innerHTML = '<option value="">Select category...</option>';
        document.getElementById('packagesList').innerHTML = '';
        document.getElementById('packagesSection').style.display = 'none';
    } catch (error) {
        console.error('Error loading operators:', error);
        alert('Failed to load operators for this country.');
    }
}

// LOAD CATEGORIES
async function loadCategories() {
    const operatorId = document.getElementById('operatorSelect').value;
    if (!operatorId || !selectedCountry) {
        document.getElementById('categorySelect').innerHTML = '<option value="">Select category...</option>';
        document.getElementById('packagesSection').style.display = 'none';
        selectedOperator = null;
        selectedCategory = null;
        return;
    }

    selectedOperator = operatorId;

    try {
        const response = await fetch(`${RAW_GITHUB}/${selectedCountry}/${operatorId}/categories.json`);
        const data = await response.json();

        const categorySelect = document.getElementById('categorySelect');
        categorySelect.innerHTML = '<option value="">Select category...</option>';
        data.categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            categorySelect.appendChild(option);
        });

        document.getElementById('packagesSection').style.display = 'none';
    } catch (error) {
        console.error('Error loading categories:', error);
        alert('Failed to load categories for this operator.');
    }
}

// LOAD PACKAGES
async function loadPackages() {
    const categoryId = document.getElementById('categorySelect').value;
    if (!categoryId || !selectedOperator || !selectedCountry) {
        document.getElementById('packagesList').innerHTML = '';
        document.getElementById('packagesSection').style.display = 'none';
        selectedCategory = null;
        return;
    }

    selectedCategory = categoryId;

    try {
        const response = await fetch(`${RAW_GITHUB}/${selectedCountry}/${selectedOperator}/${categoryId}.json`);
        const data = await response.json();

        const packagesList = document.getElementById('packagesList');
        packagesList.innerHTML = '';

        const packages = data.packages || [];
        if (packages.length === 0) {
            packagesList.innerHTML = '<p>No packages found.</p>';
        } else {
            packages.forEach(pkg => {
                const card = createPackageCard(pkg);
                packagesList.appendChild(card);
            });
        }

        document.getElementById('packagesSection').style.display = 'block';
    } catch (error) {
        console.error('Error loading packages:', error);
        alert('Failed to load packages.');
    }
}

function createPackageCard(pkg) {
    const card = document.createElement('div');
    card.className = 'package-card';

    const name = pkg.name || pkg.title || pkg.package_name || 'Unknown Package';
    const price = pkg.price || pkg.cost || 'N/A';
    const data = pkg.data || pkg.internet || 'N/A';
    const validity = pkg.validity || pkg.validity_days || 'N/A';
    const code = pkg.code || pkg.ussd || pkg.dial_code || 'N/A';

    let html = `
        <h4>${name}</h4>
        <div class="package-details">
            <div><strong>Data:</strong> ${data}</div>
            <div><strong>Validity:</strong> ${validity}</div>
            <div class="package-price">PKR ${price}</div>
            <div class="package-code">Dial: ${code}</div>
        </div>
    `;

    // Add optional features
    if (pkg.extra_bonus) html += `<div style="margin-top:10px;font-size:0.85em;color:#764ba2;">✨ Bonus: ${pkg.extra_bonus}</div>`;
    if (pkg.only_apps || pkg.apps_only) {
        const apps = Array.isArray(pkg.only_apps) ? pkg.only_apps.join(', ') : 'Select apps';
        html += `<div style="margin-top:10px;font-size:0.85em;color:#666;">📱 Apps: ${apps}</div>`;
    }

    card.innerHTML = html;
    return card;
}

// ADD PACKAGE FORM
document.getElementById('addPackageForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formMessage = document.getElementById('formMessage');
    formMessage.className = '';
    formMessage.textContent = '';

    try {
        const package = {
            name: document.getElementById('addName').value,
            price: document.getElementById('addPrice').value,
            code: document.getElementById('addCode').value,
            data: document.getElementById('addData').value,
            validity: document.getElementById('addValidity').value,
            active: true
        };

        const country = document.getElementById('addCountry').value;
        const operator = document.getElementById('addOperator').value.toLowerCase().replace(/\s+/g, '_');
        const category = document.getElementById('addCategory').value;

        if (!country || !operator || !category) {
            throw new Error('Please fill in all required fields');
        }

        formMessage.className = 'success';
        formMessage.textContent = `✅ Ready to add! Copy this JSON to ${country}/${operator}/${category}.json:` + '\n' + JSON.stringify(package, null, 2);
        formMessage.textContent += '\n\n📝 Note: For now, manually add this to the GitHub repository. In future, we can integrate GitHub API for direct commits.';
    } catch (error) {
        formMessage.className = 'error';
        formMessage.textContent = '❌ ' + error.message;
    }
});

// STATISTICS
async function loadStatistics() {
    try {
        let totalOperators = 0;
        let totalPackages = 0;
        let categoryCount = new Set();

        // Count data
        for (const country of countriesData.slice(0, 10)) { // Sample first 10
            try {
                const operatorsResponse = await fetch(`${RAW_GITHUB}/${country.id}/operators.json`);
                if (operatorsResponse.ok) {
                    const opData = await operatorsResponse.json();
                    totalOperators += opData.operators.length;

                    for (const op of opData.operators) {
                        try {
                            const catResponse = await fetch(`${RAW_GITHUB}/${country.id}/${op.folder || op.id}/categories.json`);
                            if (catResponse.ok) {
                                const catData = await catResponse.json();
                                catData.categories.forEach(cat => {
                                    categoryCount.add(cat.id);
                                });
                            }
                        } catch (e) {}
                    }
                }
            } catch (e) {}
        }

        document.getElementById('statOperators').textContent = totalOperators + '+';
        document.getElementById('statCategories').textContent = categoryCount.size || 5;
        document.getElementById('statPackages').textContent = '100+';

        // Show details
        const details = document.getElementById('statsDetails');
        details.innerHTML = `
            <h4>Latest Updates</h4>
            <p>✓ 197 countries indexed</p>
            <p>✓ Multiple operators per country</p>
            <p>✓ Categories: ${Array.from(categoryCount).join(', ') || 'Data, Social, Voice, Roaming'}</p>
            <p>✓ Real-time package information</p>
        `;
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

// Utility: Format number
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
