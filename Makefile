.PHONY: clean build up post

clean:
	bundle exec jekyll clean

build: clean
	bundle exec jekyll build

up: clean
	bundle exec jekyll serve

post:
	bundle exec ruby tools/create-post.rb "${name}"
