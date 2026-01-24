interface Window {
  api: {
    ide: {
      openWindow: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
      listFiles: (dirPath: string) => Promise<any[]>;
      readFile: (filePath: string) => Promise<string>;
      writeFile: (
        filePath: string,
        content: string,
      ) => Promise<{ success: boolean; error?: string }>;
      createItem: (
        parentPath: string,
        name: string,
        isDirectory: boolean,
      ) => Promise<{ success: boolean; path: string; error?: string }>;
      deleteItem: (itemPath: string) => Promise<{ success: boolean; error?: string }>;
      renameItem: (
        oldPath: string,
        newName: string,
      ) => Promise<{ success: boolean; path: string; error?: string }>;
    };
    dialog: {
      openDirectory: () => Promise<{ canceled: boolean; filePaths: string[]; error?: string }>;
    };
    [key: string]: any;
  };
}
