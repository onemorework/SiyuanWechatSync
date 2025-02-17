<script lang="ts">
    export let config: {
        serverUrl: string;
        token: string;
        syncInterval: number;
    };
    export let save: (config: any) => void;

    let localConfig = { ...config };

    function handleSubmit() {
        save(localConfig);
    }
</script>

<div class="b3-dialog__content">
    <div class="b3-dialog__body">
        <div class="config__item">
            <label for="syncInterval" class="fn__flex">服务器地址</label>
            <input 
                type="text" 
                bind:value={localConfig.serverUrl}
                class="b3-text-field fn__flex-1"
                placeholder="请输入服务器地址"
            />
        </div>
        <div class="config__item">
            <label for="syncInterval" class="fn__flex">Token</label>
            <input 
                type="password" 
                bind:value={localConfig.token}
                class="b3-text-field fn__flex-1"
                placeholder="请输入认证Token"
            />
        </div>
        <div class="config__item">
            <label for="syncInterval" class="fn__flex">同步周期（秒）</label>
            <input 
                type="number" 
                bind:value={localConfig.syncInterval}
                class="b3-text-field fn__flex-1"
                min="0"
                placeholder="请输入同步周期（秒）"
            />
        </div>
    </div>
    <div class="b3-dialog__action">
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

.config__item label {
    font-weight: 500;
}
</style> 