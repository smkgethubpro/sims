# SIM Packages Manager Dashboard

A web-based interface for managing and browsing mobile operator SIM packages across 197 countries.

## Features

✨ **Browse Packages** - Navigate through countries, operators, and categories to find specific packages

➕ **Add Packages** - Easy form to add new packages to the database

📊 **Statistics** - View repository statistics and metadata

📖 **Documentation** - Complete guide on repository structure and conventions

🌍 **197 Countries** - Comprehensive coverage across all regions

📱 **Responsive Design** - Works on desktop, tablet, and mobile

## Live Access

The dashboard is available at: https://smkgethubpro.github.io/sims/

## Repository Structure

```
sims/
├── countries.json          # Main index
├── [country]/
│   ├── operators.json      # Operators in country
│   └── [operator]/
│       ├── categories.json  # Category definitions
│       ├── data.json       # Data packages
│       ├── social.json     # Social packages
│       └── ...
└── docs/                   # GitHub Pages files
    ├── index.html          # Main dashboard
    ├── styles.css          # Styling
    └── script.js           # Functionality
```

## How to Use

### Browse Packages

1. Click the **"Browse"** tab
2. Select a country from the dropdown
3. Choose an operator
4. Pick a category (Data, Social, etc.)
5. View all available packages

### Add a New Package

1. Click the **"Add Package"** tab
2. Fill in the package details:
   - Country
   - Operator
   - Category
   - Package name, price, data, validity, USSD code
3. Click "Add Package"
4. The generated JSON will be displayed
5. Manually add it to the repository or create a PR

### View Statistics

Click the **"Statistics"** tab to see:
- Total countries covered
- Number of operators
- Package categories
- Recent updates

## Package JSON Format

```json
{
  "name": "Monthly Supreme",
  "price": "1738",
  "cost": 1738,
  "code": "*117*30#",
  "ussd": "*117*30#",
  "data": "25GB",
  "data_amount": 25,
  "unit": "GB",
  "validity": "30 Days",
  "duration_days": 30,
  "network": "Jazz",
  "active": true
}
```

## Supported Categories

- **data** - Internet/Data packages
- **social** - Social media focused packages
- **voice** - Call minutes packages
- **roaming** - International roaming packages
- **combo** - Mixed services packages

## Adding a New Country

1. Add entry to `countries.json`:
   ```json
   { "id": "xx", "name": "Country Name", "file": "xx/operators.json" }
   ```

2. Create directory: `xx/`

3. Add `operators.json` with operators:
   ```json
   {
     "operators": [
       { "id": "op1", "name": "Operator 1", "folder": "operator1" }
     ]
   }
   ```

4. Create operator directories with:
   - `categories.json` - List of categories
   - `[category].json` - Package data for each category

## Technical Details

- **Frontend Framework**: Vanilla JavaScript (No dependencies)
- **Styling**: CSS3 with modern gradients and animations
- **Data Source**: GitHub Raw Content API
- **Hosting**: GitHub Pages
- **Browser Support**: All modern browsers

## Development

To modify the dashboard:

1. Edit files in the `docs/` directory
2. Push changes to `main` branch
3. Changes are live within seconds

## Limitations

- ⚠️ Adding packages requires manual GitHub editing or PR creation
- ⚠️ Requires public repository for API access
- ⚠️ GitHub API rate limiting applies (60 requests/hour unauthenticated)

## Future Enhancements

- [ ] Direct GitHub API integration for package creation
- [ ] User authentication with GitHub
- [ ] Real-time data validation
- [ ] Package export (CSV, Excel)
- [ ] Price comparison tools
- [ ] Package recommendations
- [ ] Multi-language support
- [ ] Dark mode theme

## Contributing

To add or update packages:

1. Use the "Add Package" form to generate JSON
2. Fork the repository
3. Add/edit the appropriate JSON files
4. Submit a pull request

## License

This project is open source and available for anyone to use and modify.

## Support

For issues or questions, please open a GitHub issue in the repository.
