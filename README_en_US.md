# Siyuan Note WeChat Sync Plugin

[中文](./README.md)

A plugin to sync content from the WeChat public account (云笔记助手) to Siyuan Note.

<img src="./asset/wechat_qr.png" alt="wechat" width="300"/>

## Privacy and Security

**Due to the current mechanism of WeChat public accounts, all messages can be viewed in the backend of the public account. We promise not to actively browse any information and will regularly delete user conversation data. However, for your privacy and security, please do not send sensitive data.**

## Features

* Supports automatic synchronization of note content from the Cloud Note Assistant public account
* Supports setting automatic synchronization intervals
* Supports selecting the target notebook and document for synchronization
* Supports automatic synchronization when the plugin is loaded
* Supports manual synchronization

## Instructions

### 1. Get the Binding Key

1. Follow the "Cloud Note Assistant" WeChat public account
2. Send "!bind" in the public account to get the binding key

### 2. Configure the Plugin

1. Install this plugin in Siyuan Note
2. Click the plugin icon in the top bar to open the settings interface
3. In the settings interface:
  - Enter your binding key (Token)
  - Select the notebook to sync to
  - Select the document to sync to
  - Set the synchronization interval (optional, 0 means no automatic synchronization)
  - Set whether to automatically synchronize when the plugin is loaded

### 3. Start Using

1. Send the content you want to save in the Cloud Note Assistant public account
2. The content will be automatically synchronized to Siyuan Note according to your settings
3. You can also click the sync icon in the top bar to manually trigger synchronization

## Notes

1. The current daily limit for sending notes is 5
2. Please keep your binding key safe and do not share it with others
3. The synchronization function requires Siyuan Note to be open
4. It is recommended to choose a dedicated document for synchronization to avoid mixing with other content
5. If you encounter synchronization issues, you can try:
  - Checking if the binding key is correct
  - Ensuring the network connection is normal
  - Re-selecting the target notebook and document
  - Restarting Siyuan Note

## Changelog

Please check [CHANGELOG.md](./CHANGELOG.md)

## Feedback

If you encounter any problems or have any suggestions during use, please provide feedback through the following ways:

1. Submit an issue on GitHub
2. Provide feedback in the Siyuan Note forum
3. Provide feedback through the Cloud Note Assistant public account

## License

This plugin is open-sourced under the [LGPL-3.0](./LICENSE) license.

## Acknowledgements

Thank you for using this plugin! Special thanks to Siyuan Note for providing an excellent note-taking platform.