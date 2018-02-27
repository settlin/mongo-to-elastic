# mongo-to-elastic meteor package

### Usage

```
git clone git@github.com:settlin/mongo-to-elastic.git
node index.js /path/to/config.js
```

or 

```
npm run sync -- /path/to/config.js
```

The sync does not update removals, and simply works on timestamps (`createdAt` and `updatedAt` fields) present in your mongo documents.

See [a relative link](config-example.js) for details.


### Backup

The nifty `backup.sh` backs up entire elastic db to aws s3. It is a very simple script depending on `elasticdump` and `aws` cli and you can tweak it for your personal use.


