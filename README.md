# all-my-plus-statistics

### Description

Various reports based on either public Google+ posts or takeout data.

You can check out a running version here: http://www.allmyplus.com/

### Requirements/Installation

1.  OAuth Tokens and Application Key at the [Google APIs Console](https://code.google.com/apis/console/)

    Create a new project.

    Activate the Google+ API in `Services`

    Create OAuth2 Tokens in `API Access`

    Adjust settings in Quotas as necessary.

    Edit `config.php` to set `$client_id`, `$client_secret` and `$developer_key` accordingly.


2.  Base-URL

    Edit `config.php` to set `$base_url` to the path where you place the scripts.


### Licenses

```
Copyright (c) 2013 Gerwin Sturm, FoldedSoft e.U. / www.foldedsoft.at

Licensed under the Apache License, Version 2.0 (the "License"); you may not
use this file except in compliance with the License. You may obtain a copy of
the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
License for the specific language governing permissions and limitations under
the License

```
