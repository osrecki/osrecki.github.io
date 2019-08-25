.PHONY: up post

up:
	bundle exec jekyll serve

post:
	bundle exec ruby tools/create-post.rb "${name}"
