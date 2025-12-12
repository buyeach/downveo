
            const input = document.getElementById('videoUrl');

            input.focus();

            input.select();

            

            // 尝试从剪贴板读取（需要用户授权）

            if (navigator.clipboard && navigator.clipboard.readText) {

                navigator.clipboard.readText().then(text => {

                    if (text && (text.includes('http://') || text.includes('https://'))) {

                        if (confirm('检测到剪贴板中有链接：' + text + '\\n是否使用此链接？')) {

                            input.value = text;

                        }

                    }

                }).catch(err => {

                    // 用户拒绝授权或其它错误，忽略

                });

            }

        });
