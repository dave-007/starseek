# Repository Transfer Guide

## Moving StarSeek from dave-007 to alongside-cc Organization

This guide documents the easiest way to move this repository from the personal account `dave-007` to the `alongside-cc` organization.

## The Easiest Method: GitHub's Built-in Transfer Feature

GitHub provides a built-in repository transfer feature that handles all the complexity automatically. This is the recommended approach.

### Steps to Transfer

1. **Navigate to Repository Settings**
   - Go to https://github.com/dave-007/starseek
   - Click on **Settings** (requires admin access)

2. **Scroll to Danger Zone**
   - At the bottom of the Settings page, find the "Danger Zone" section
   - Click **Transfer** button

3. **Enter Transfer Details**
   - New owner: `alongside-cc`
   - Repository name: `starseek` (or choose a new name if desired)
   - Type the repository name to confirm

4. **Complete Transfer**
   - Click **I understand, transfer this repository**
   - You may need to enter your password to confirm
   - If you're not already a member of `alongside-cc`, the organization owner will need to approve the transfer

### What GitHub Handles Automatically

✅ All git history and commits are preserved  
✅ All branches and tags are transferred  
✅ All issues, pull requests, and discussions move over  
✅ All GitHub Actions workflows are transferred  
✅ GitHub automatically sets up a redirect from the old URL to the new one  
✅ Existing clones continue to work (redirect handles `git pull`)  
✅ Stars and watchers are preserved  

### Post-Transfer Checklist

After the transfer is complete, update the following:

#### 1. Local Git Remotes
```bash
# Update your local repository remote URL
git remote set-url origin https://github.com/alongside-cc/starseek.git

# Verify the change
git remote -v
```

#### 2. Update Documentation
- [ ] Update any hardcoded repository URLs in documentation
- [ ] Update links in README.md (if any)
- [ ] Update package.json repository field

#### 3. External Services
- [ ] **Vercel**: Update deployment settings to point to alongside-cc/starseek
  - Go to Vercel project settings
  - Reconnect the repository from the new organization
- [ ] **GitHub Pages**: Will automatically update (if using)
- [ ] **CI/CD Secrets**: Verify all secrets are still accessible in the new organization

#### 4. Access Permissions
- [ ] Verify team members have appropriate access in the organization
- [ ] Set up branch protection rules if needed
- [ ] Configure organization-level settings as needed

### Important Notes

- **The old URL still works**: GitHub maintains a permanent redirect from `dave-007/starseek` → `alongside-cc/starseek`
- **Existing clones work**: Users don't need to re-clone; `git pull` continues to work via redirect
- **Transfer is reversible**: You can transfer the repository back if needed (though not recommended)

### Alternative Methods (Not Recommended)

While you could fork or manually clone/push, these approaches have significant drawbacks:
- ❌ Forks lose issue/PR history
- ❌ Manual clone/push loses stars, watchers, and metadata
- ❌ No automatic redirects from the old URL

The built-in transfer feature is superior in every way.

## Timeline

The actual transfer takes only a few seconds. Post-transfer updates (Vercel, local remotes) may take 10-15 minutes total.

## Questions or Issues?

If you encounter any problems during the transfer:
1. GitHub's transfer documentation: https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository
2. Contact GitHub support if the transfer button is not available
3. Ensure you have admin permissions on both the source repo and destination organization
