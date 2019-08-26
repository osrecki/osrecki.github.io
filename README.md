#### Prerequisites
```sh
echo "127.0.0.1 kodin.me.local" | sudo tee -a /etc/hosts
```

#### Run
```sh
make up
open "http://kodin.me.local:7654"
```

#### Create new post
```sh
make post name="<NAME>"
```
