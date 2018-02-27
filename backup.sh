#! /bin/bash

# Gets current date
cdate=$(date +%Y-%m-%d)
echo -e '\n\n============='
echo '============='
echo $cdate
echo '============='
echo '============='

DIR=/tmp/elastic/$cdate
mkdir -p $DIR
rm $DIR/.*json
rm $DIR/*json
multielasticdump --input=http://localhost:9200 --output=$DIR --quiet true --debug false --parallel 10
cd $DIR && tar zcf /tmp/$cdate.tgz . && cd - 
$HOME/.local/bin/aws s3 cp /tmp/$cdate.tgz s3://settlin-backups/elastic/
echo "Backup done"
