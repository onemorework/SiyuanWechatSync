declare module "siyuan" {
    export class Plugin {
        public loadData(key: string): Promise<any>;
        public saveData(key: string, value: any): Promise<void>;
        public i18n: Record<string, string>;
        protected addTopBar(options: {
            icon: string;
            title: string;
            position: string;
            callback: () => void;
        }): void;
    }

    export class Dialog {
        constructor(options: {
            title: string;
            content: string;
            width?: string;
        });
        destroy(): void;
    }

    export function showMessage(text: string): void;
} 