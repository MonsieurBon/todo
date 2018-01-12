#!/usr/bin/php
<?php

exec('git diff --cached --name-only --diff-filter=ACM', $changedFiles);

$phpFiles = array_filter($changedFiles, function ($file) {
    if (pathinfo($file, PATHINFO_EXTENSION) !== 'php') {
        return false;
    }

    $path = pathinfo($file, PATHINFO_DIRNAME);
    $dirnames = explode('/', $path);

    if (in_array('Migrations', $dirnames)) {
        return false;
    }

    return true;
});

foreach ($phpFiles as $file) {
    $lint_output = [];
    exec('php -l ' . escapeshellarg($file), $lint_output, $return);

    if ($return !== 0) {
        echo implode("\n", $lint_output), "\n";
        exit(1);
    } else {
        $lint_output = [];
        exec("vendor/bin/php-cs-fixer fix --dry-run {$file} 2>&1", $lint_output, $return);

        if ($return !== 0) {
            echo implode("\n", $lint_output), "\n";
            exit(1);
        }
    }
}

exec('yarn lint');

exit(0);
