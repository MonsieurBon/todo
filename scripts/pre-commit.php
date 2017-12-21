#!/usr/bin/php
<?php

exec('git diff --cached --name-only --diff-filter=ACM', $output);

foreach ($output as $file) {
    if (pathinfo($file, PATHINFO_EXTENSION) == 'php') {
        $lint_output = [];
        exec('php -l ' . escapeshellarg($file), $lint_output, $return);

        if ($return !== 0) {
            echo implode("\n", $lint_output), "\n";
            exit(1);
        } else {
            exec("vendor/bin/php-cs-fixer fix --dry-run {$file}", $lint_output, $return);

            if ($return !== 0) {
                echo implode("\n", $lint_output), "\n";
                exit(1);
            }
        }
    }
}

exit(0);
