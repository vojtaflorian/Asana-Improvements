# Asana Better Workflow

A production-ready UserScript that enhances Asana's interface with improved workflow features, better visibility, and streamlined task management.

## 🚀 Features

### 📅 Intelligent Due Date Display
- **Automatic Days Remaining Calculation**: Shows number of days remaining next to each due date
- **Smart Date Parsing**: Handles various date formats including "Today", "Tomorrow", day names, and standard dates
- **Real-time Updates**: Automatically updates as you navigate through Asana

### 🔄 Auto-Expand Content
- **Automatic Subtask Loading**: Automatically clicks "Load more" buttons for subtasks
- **Comment Expansion**: Auto-expands truncated comments
- **Seamless Experience**: No manual clicking required to see all content

### ✅ Toggle Completed Tasks
- **Hide/Show Completed Tasks**: One-click toggle to hide or show completed subtasks
- **Visual Indicators**: Shows clickable indicators when completed tasks are present
- **Persistent State**: Remembers your preference across sessions
- **Topbar Button**: Quick access toggle button in the Asana topbar

### 🎨 UI Enhancements
- **Optimized Pane Widths**: Better use of screen real estate with wider task panes
- **Compact Cell Display**: More efficient column spacing in list views
- **Premium Features Hidden**: Removes distracting paywall UI elements
- **Clean Interface**: Minimalist approach focusing on productivity

## 📦 Installation

### Prerequisites
- A UserScript manager extension:
  - [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Safari, Edge)
  - [Violentmonkey](https://violentmonkey.github.io/) (Chrome, Firefox, Edge)
  - [Greasemonkey](https://www.greasespot.net/) (Firefox)

### Installation Steps

1. **Install a UserScript Manager**
   - Install Tampermonkey or another UserScript manager from your browser's extension store

2. **Install the Script**
   - Click on this link: [AsanaBetterWorkflow.js](https://raw.githubusercontent.com/vojtaflorian/Asana-Improvements/main/AsanaBetterWorkflow.js)
   - Your UserScript manager should automatically detect the script and prompt for installation
   - Click "Install" or "Confirm installation"

3. **Verify Installation**
   - Navigate to [app.asana.com](https://app.asana.com)
   - You should see the "Toggle Complete tasks" button in the top navigation
   - Due dates should show days remaining

### Manual Installation

1. Open your UserScript manager's dashboard
2. Create a new script
3. Copy the entire contents of `AsanaBetterWorkflow.js`
4. Paste into the new script
5. Save and enable the script

## ⚙️ Configuration

The script includes a centralized configuration object that allows easy customization:

```javascript
const CONFIG = {
    // UI configuration
    ui: {
        detailsPaneWidth: '80%',
        taskPaneWidth: '65%',
        taskPaneMinWidth: '50%',
        compactCellWidth: '80px',
        maxEnumValueWidth: '100px',
        enumValuePadding: '5px'
    },
    
    // Feature toggles
    features: {
        daysLeftCalculation: true,
        autoExpandSubtasks: true,
        autoExpandComments: true,
        toggleCompletedTasks: true,
        hidePaywallElements: true
    },
    
    // Performance configuration
    performance: {
        mutationObserverDebounce: 100,
        maxObserverRetries: 3,
        observerTimeout: 30000
    }
};
```

### Customizing Features

To disable specific features, edit the `CONFIG.features` object in the script:

```javascript
features: {
    daysLeftCalculation: false,      // Disable days remaining calculation
    autoExpandSubtasks: true,        // Keep auto-expand subtasks
    autoExpandComments: false,       // Disable auto-expand comments
    toggleCompletedTasks: true,      // Keep toggle functionality
    hidePaywallElements: true        // Keep hiding premium UI
}
```

## 🎯 Usage

### Toggle Completed Tasks

**Method 1: Topbar Button**
- Click the "Toggle Complete tasks" button in the top navigation bar
- All completed subtasks will be hidden/shown across all tasks

**Method 2: Inline Indicator**
- When viewing a task with completed subtasks, look for the red "[Toggle Complete tasks]" indicator
- Click it to toggle visibility for that specific task's completed subtasks

### Days Remaining Display

Days remaining are automatically calculated and displayed for all due dates:
- Format: `Due Date (X days)`
- Only shows for future dates
- Updates automatically as you navigate

### Auto-Expand Features

The script automatically:
- Loads all subtasks without manual clicking
- Expands truncated comment text
- Runs on initial page load and dynamically as content changes

## 🛠️ Development

### Project Structure

```
asana-better-workflow/
├── AsanaBetterWorkflow.js    # Main script file
├── README.md                  # This file
└── LICENSE                    # MIT License
```

### Code Architecture

The script is organized into logical sections:

1. **Configuration**: Centralized config object for easy maintenance
2. **Utility Functions**: Safe DOM operations and helper functions
3. **Style Injection**: Dynamic CSS rules based on configuration
4. **Date Parsing**: Intelligent date string parsing and calculation
5. **Auto-Expand**: Automatic content expansion functionality
6. **Toggle Completed Tasks**: Show/hide completed task management
7. **Mutation Observer**: Monitors DOM changes for real-time updates
8. **Initialization**: Setup and initialization logic

### Error Handling

The script includes comprehensive error handling:
- Try-catch blocks in all functions
- Input validation for all operations
- Safe DOM queries that won't break on missing elements
- Graceful degradation when features fail
- Console error logging for debugging

### Browser Compatibility

Tested and working on:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 🐛 Debugging

### Debug API

The script exposes a public API for debugging:

```javascript
// Access the API in browser console
window.AsanaWorkflowEnhancement

// Available methods:
AsanaWorkflowEnhancement.config                      // View current configuration
AsanaWorkflowEnhancement.utils.updateDueDates()     // Manually trigger due date update
AsanaWorkflowEnhancement.utils.autoExpandContent()  // Manually trigger auto-expand
AsanaWorkflowEnhancement.utils.toggleCompletedSubtasks()  // Toggle completed tasks
AsanaWorkflowEnhancement.version                     // Check script version
```

### Common Issues

**Issue: Script not loading**
- Solution: Check that your UserScript manager is enabled
- Solution: Verify the script is active in the UserScript manager dashboard
- Solution: Refresh the Asana page (hard refresh: Ctrl+Shift+R / Cmd+Shift+R)

**Issue: Toggle button not appearing**
- Solution: Wait a moment for the page to fully load
- Solution: Check browser console for errors
- Solution: Verify `toggleCompletedTasks` feature is enabled in CONFIG

**Issue: Days not showing on due dates**
- Solution: Verify `daysLeftCalculation` feature is enabled
- Solution: Check that dates are in supported formats
- Solution: Try manually running: `AsanaWorkflowEnhancement.utils.updateDueDates()`

**Issue: Auto-expand not working**
- Solution: Verify both `autoExpandSubtasks` and `autoExpandComments` are enabled
- Solution: Check that Asana hasn't changed their DOM structure
- Solution: Try manually running: `AsanaWorkflowEnhancement.utils.autoExpandContent()`

## 🔒 Privacy & Security

- **No Data Collection**: This script does not collect, store, or transmit any data
- **Local Storage Only**: Uses browser's localStorage only for toggle state persistence
- **No External Requests**: All functionality runs locally in your browser
- **Open Source**: Full source code is available for review
- **No Analytics**: No tracking or analytics of any kind

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 👤 Author

**Vojta Florian**
- Website: [vojtaflorian.com](https://vojtaflorian.com)
- GitHub: [@vojtaflorian](https://github.com/vojtaflorian)

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

### How to Contribute

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Coding Standards

- Use English for all variable names, functions, and comments
- Include JSDoc comments for all functions
- Implement error handling for all operations
- Follow the existing code structure and style
- Test thoroughly in multiple browsers

## 📝 Changelog

### Version 1.0.0 (Current)
- ✨ Production-ready release
- ✨ Complete code refactoring with English naming
- ✨ Comprehensive error handling
- ✨ Centralized configuration system
- ✨ Debounced mutation observer for performance
- ✨ Public debugging API
- ✨ Full JSDoc documentation
- ✨ Safe DOM operations
- ✨ Feature toggles

### Version 0.442 (Legacy)
- Initial release with basic features
- Mixed language code (Czech/English)
- Basic functionality without comprehensive error handling

## 🙏 Acknowledgments

- Asana team for creating a great project management platform
- UserScript community for tools and best practices
- All contributors and users who provided feedback

## ⭐ Support

If you find this script helpful, please consider:
- ⭐ Starring the repository
- 🐛 Reporting bugs and issues
- 💡 Suggesting new features
- 🤝 Contributing code improvements
- 📢 Sharing with others who use Asana

---

**Note**: This is an unofficial third-party enhancement and is not affiliated with, endorsed by, or connected to Asana, Inc.
