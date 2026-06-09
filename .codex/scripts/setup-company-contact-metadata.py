#!/usr/bin/env python3

from crm_contact_import import main


if __name__ == "__main__":
    raise SystemExit(main(["--setup-metadata-only", "--apply"]))
