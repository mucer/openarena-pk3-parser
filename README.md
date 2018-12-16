# OpenArena PK3 parser

This package parses a OpenArena PK3 file (or a folder containing PK3 files) and returns them as JavaScript object. It also provides a CacheManager which can store
the parse results in the file system.

## Usage

You can use the `CacheManager` which will handle all known file types.

```typescript
import { CacheManager } from 'openarena-pk3-parser';

const cacheDir = join(__dirname, 'cache');

const cache = new CacheManager(cacheDir);
cache.addPk3Dir('/opt/openarena-0.8.8/baseoa');
cache.init().then(() => console.log('Cache initialized'));
```

You also can handle the processing by yourself

```typescript
import { streamPk3Dirs } from 'openarena-pk3-parser';

streamPk3Dirs(['/opt/openarena-0.8.8/baseoa'], true)
    .on('entry', e => handleEntry());
```