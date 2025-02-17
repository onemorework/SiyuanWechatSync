<script lang="ts">
    import { onMount } from 'svelte';
    import { fetchPost } from "siyuan";
    
    export let config: {
        serverUrl: string;
        token: string;
        syncInterval: number;
        selectedNotebookId: string;
        selectedDocId: string;
    };
    export let save: (config: any) => void;
    export let syncNow: () => void;

    let localConfig = { ...config };
    let notebooks: any[] = [];
    let docTree: any[] = [];

    async function loadNotebooks() {
        try {
            fetchPost('/api/notebook/lsNotebooks', {}, (response: any) => {
                notebooks = response.data || [];
            });
        } catch (error) {
            console.error('获取笔记本列表失败:', error);
        }
    }

    async function loadDocTree() {
        if (!localConfig.selectedNotebookId) return;
        try {
            fetchPost('/api/filetree/getDoc', {
                id: localConfig.selectedNotebookId
            }, (response: any) => {
                docTree = response.data || [];
            });
        } catch (error) {
            console.error('获取文档树失败:', error);
        }
    }

    onMount(() => {
        loadNotebooks();
    });

    $: if (localConfig.selectedNotebookId) {
        loadDocTree();
    }

    function handleSubmit() {
        save(localConfig);
    }
</script>

<div class="b3-dialog__content">
    <div class="b3-dialog__body">
        <div class="config__item">
            <label for="notebook">选择笔记本</label>
            <select 
                id="notebook"
                class="b3-text-field fn__flex-1"
                bind:value={localConfig.selectedNotebookId}
            >
                <option value="">请选择笔记本</option>
                {#each notebooks as notebook}
                    <option value={notebook.id}>{notebook.name}</option>
                {/each}
            </select>
        </div>

        {#if docTree.length > 0}
        <div class="config__item">
            <label for="docTree">文档树</label>
            <div id="docTree" class="doc-tree" role="tree">
                {#each docTree as doc}
                    <div class="doc-item" 
                         role="treeitem" 
                         aria-selected={localConfig.selectedDocId === doc.id}>
                        {doc.name}
                    </div>
                {/each}
            </div>
        </div>
        {/if}

        <div class="config__item">
            <label for="serverUrl">服务器地址</label>
            <input 
                id="serverUrl"
                type="text" 
                bind:value={localConfig.serverUrl}
                class="b3-text-field fn__flex-1"
            />
        </div>
        <div class="config__item">
            <label for="token">Token</label>
            <input 
                id="token"
                type="password" 
                bind:value={localConfig.token}
                class="b3-text-field fn__flex-1"
            />
        </div>
        <div class="config__item">
            <label for="syncInterval">同步周期（秒）</label>
            <input 
                id="syncInterval"
                type="number" 
                bind:value={localConfig.syncInterval}
                class="b3-text-field fn__flex-1"
                min="0"
            />
        </div>
    </div>
    <div class="b3-dialog__action">
        <button class="b3-button" on:click={syncNow}>立即同步</button>
        <button class="b3-button b3-button--primary" on:click={handleSubmit}>
            保存
        </button>
    </div>
</div>

<style>
.config__item {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.doc-tree {
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid var(--b3-border-color);
    padding: 8px;
}

.doc-item {
    padding: 4px 8px;
    cursor: pointer;
}

.doc-item:hover {
    background-color: var(--b3-theme-background-light);
}
</style> 