require "date"

name = ARGV[0]

file_name = "#{Date.today.to_s}-#{name.downcase.gsub(/\s+/, "-")}.md"
file_path = File.join(File.dirname(__FILE__), "../_posts", file_name)

front_matter =
<<~EOS
---
layout: post
title:  #{name}
date:   #{Time.now}
author: Dinko Osrecki
tags:   
---
EOS

File.open(file_path, "w") do |file|
  file.write(front_matter)
end
