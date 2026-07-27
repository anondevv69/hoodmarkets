// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title HoodFeeLock
/// @notice Time-locked ERC-20 vault for hood.markets `$FEES` meme-side fee inventory.
///         Each lock is an ERC-721 NFT. No early release — only `block.timestamp >= unlockTime`.
/// @dev HoodMarkets fork of the general TimeLockVault pattern (TLV), scoped for the fees loop.
contract HoodFeeLock is ERC721, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Strings for uint256;

    /// @notice Default lock used by the fees loop (~100 years).
    uint256 public constant DEFAULT_LOCK_DURATION = 100 * 365 days;

    struct Lock {
        address token;
        uint256 amount;
        uint256 unlockTime;
        bool withdrawn;
        address depositor;
        uint256 createdAt;
    }

    error LockNotExpired();
    error AlreadyWithdrawn();
    error NotLockOwner();
    error ZeroAmount();
    error ZeroLockTime();
    error ZeroToken();
    error ZeroRecipient();
    error InvalidLockId();
    error UnlockOverflow();

    mapping(uint256 => Lock) public locks;
    uint256 public nextLockId = 1;

    event Deposited(
        uint256 indexed lockId,
        address indexed depositor,
        address indexed token,
        uint256 amount,
        uint256 unlockTime,
        address nftRecipient
    );
    event Withdrawn(uint256 indexed lockId, address indexed withdrawer, uint256 amount);
    event LockExtended(uint256 indexed lockId, uint256 newUnlockTime);

    constructor() ERC721("Hood Fee Lock", "HFL") {}

    /// @notice Lock ERC-20 tokens for `lockTime` seconds. Mints the lock NFT to the caller.
    function deposit(address token, uint256 amount, uint256 lockTime)
        external
        nonReentrant
        returns (uint256 lockId)
    {
        return _deposit(token, amount, lockTime, msg.sender);
    }

    /// @notice Lock ERC-20 tokens and mint the lock NFT to `nftRecipient`.
    function depositFor(address token, uint256 amount, uint256 lockTime, address nftRecipient)
        external
        nonReentrant
        returns (uint256 lockId)
    {
        if (nftRecipient == address(0)) revert ZeroRecipient();
        return _deposit(token, amount, lockTime, nftRecipient);
    }

    /// @notice Convenience: lock for the default ~100 year duration; NFT to caller.
    function depositDefault(address token, uint256 amount)
        external
        nonReentrant
        returns (uint256 lockId)
    {
        return _deposit(token, amount, DEFAULT_LOCK_DURATION, msg.sender);
    }

    /// @notice Convenience: lock for ~100 years; NFT to `nftRecipient`.
    function depositDefaultFor(address token, uint256 amount, address nftRecipient)
        external
        nonReentrant
        returns (uint256 lockId)
    {
        if (nftRecipient == address(0)) revert ZeroRecipient();
        return _deposit(token, amount, DEFAULT_LOCK_DURATION, nftRecipient);
    }

    /// @notice Withdraw after unlock. Burns the lock NFT.
    function withdraw(uint256 lockId) external nonReentrant {
        _requireActiveLockOwner(lockId);
        Lock storage lock_ = locks[lockId];

        if (lock_.withdrawn) revert AlreadyWithdrawn();
        if (block.timestamp < lock_.unlockTime) revert LockNotExpired();

        lock_.withdrawn = true;
        uint256 amount = lock_.amount;
        IERC20(lock_.token).safeTransfer(msg.sender, amount);
        _burn(lockId);

        emit Withdrawn(lockId, msg.sender, amount);
    }

    /// @notice Extend unlock time. Can only add time.
    function extendLock(uint256 lockId, uint256 additionalSeconds) external {
        _requireActiveLockOwner(lockId);
        Lock storage lock_ = locks[lockId];

        if (lock_.withdrawn) revert AlreadyWithdrawn();
        if (additionalSeconds == 0) revert ZeroLockTime();

        uint256 newUnlock = lock_.unlockTime + additionalSeconds;
        if (newUnlock < lock_.unlockTime) revert UnlockOverflow();

        lock_.unlockTime = newUnlock;
        emit LockExtended(lockId, newUnlock);
    }

    function getLock(uint256 lockId) external view returns (Lock memory) {
        _requireExistingLock(lockId);
        return locks[lockId];
    }

    function isUnlocked(uint256 lockId) external view returns (bool) {
        _requireExistingLock(lockId);
        return block.timestamp >= locks[lockId].unlockTime;
    }

    function timeRemaining(uint256 lockId) external view returns (uint256) {
        _requireExistingLock(lockId);
        uint256 unlockTime = locks[lockId].unlockTime;
        return block.timestamp >= unlockTime ? 0 : unlockTime - block.timestamp;
    }

    function tokenURI(uint256 lockId) public view override returns (string memory) {
        _requireExistingLock(lockId);

        Lock memory lock_ = locks[lockId];
        bool unlocked = block.timestamp >= lock_.unlockTime;
        string memory statusText =
            lock_.withdrawn ? "WITHDRAWN" : unlocked ? "UNLOCKED" : "LOCKED";
        string memory statusColor =
            lock_.withdrawn ? "#6b7280" : unlocked ? "#22c55e" : "#ef4444";

        uint256 remaining = unlocked ? 0 : (lock_.unlockTime - block.timestamp);
        string memory timeStr = lock_.withdrawn
            ? "Claimed"
            : unlocked ? "Available now" : _formatDuration(remaining);

        uint256 seed =
            uint256(keccak256(abi.encodePacked(lockId, lock_.token, lock_.amount, lock_.unlockTime)));
        uint256 hue = seed % 360;

        string memory svg = string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">',
                '<defs><radialGradient id="g" cx="50%" cy="40%" r="60%">',
                '<stop offset="0%" stop-color="hsl(',
                hue.toString(),
                ',70%,35%)"/>',
                '<stop offset="100%" stop-color="#0a0a0a"/></radialGradient></defs>',
                '<rect width="512" height="512" fill="url(#g)"/>',
                '<circle cx="256" cy="220" r="78" fill="none" stroke="',
                statusColor,
                '" stroke-width="6" opacity="0.9"/>',
                '<rect x="216" y="250" width="80" height="70" rx="10" fill="',
                statusColor,
                '" opacity="0.85"/>',
                '<text x="256" y="380" text-anchor="middle" fill="#f5f5f5" font-size="28" font-family="monospace">',
                statusText,
                "</text>",
                '<text x="256" y="420" text-anchor="middle" fill="#a3a3a3" font-size="16" font-family="monospace">',
                timeStr,
                "</text>",
                '<text x="256" y="460" text-anchor="middle" fill="#737373" font-size="14" font-family="monospace">Lock #',
                lockId.toString(),
                "</text></svg>"
            )
        );

        string memory json = string(
            abi.encodePacked(
                '{"name":"Hood Fee Lock #',
                lockId.toString(),
                '","description":"hood.markets century lock for $FEES meme-side trading fees. NFT ownership = withdrawal rights after unlock. No early release.",',
                '"image_data":"data:image/svg+xml;base64,',
                Base64.encode(bytes(svg)),
                '","attributes":[',
                '{"trait_type":"Status","value":"',
                statusText,
                '"},',
                '{"trait_type":"Token","value":"',
                _addressShort(lock_.token),
                '"},',
                '{"trait_type":"Amount","value":"',
                lock_.amount.toString(),
                '"},',
                '{"trait_type":"Unlock Time","value":"',
                lock_.unlockTime.toString(),
                '"},',
                '{"trait_type":"Depositor","value":"',
                _addressShort(lock_.depositor),
                '"},',
                '{"trait_type":"Withdrawn","value":"',
                lock_.withdrawn ? "true" : "false",
                '"}]}'
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    function _deposit(address token, uint256 amount, uint256 lockTime, address nftRecipient)
        internal
        returns (uint256 lockId)
    {
        if (token == address(0)) revert ZeroToken();
        if (amount == 0) revert ZeroAmount();
        if (lockTime == 0) revert ZeroLockTime();

        uint256 unlockTime = block.timestamp + lockTime;
        if (unlockTime < block.timestamp) revert UnlockOverflow();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        lockId = nextLockId++;
        locks[lockId] = Lock({
            token: token,
            amount: amount,
            unlockTime: unlockTime,
            withdrawn: false,
            depositor: msg.sender,
            createdAt: block.timestamp
        });

        _mint(nftRecipient, lockId);

        emit Deposited(lockId, msg.sender, token, amount, unlockTime, nftRecipient);
    }

    function _requireExistingLock(uint256 lockId) internal view {
        if (lockId == 0 || lockId >= nextLockId) revert InvalidLockId();
    }

    function _requireActiveLockOwner(uint256 lockId) internal view {
        _requireExistingLock(lockId);
        if (_ownerOf(lockId) == address(0)) revert InvalidLockId();
        if (ownerOf(lockId) != msg.sender) revert NotLockOwner();
    }

    function _formatDuration(uint256 seconds_) internal pure returns (string memory) {
        if (seconds_ == 0) return "0s";
        uint256 days_ = seconds_ / 86_400;
        uint256 hours_ = (seconds_ % 86_400) / 3600;
        if (days_ > 0) {
            return string(abi.encodePacked(days_.toString(), "d ", hours_.toString(), "h remaining"));
        }
        uint256 mins_ = (seconds_ % 3600) / 60;
        return string(abi.encodePacked(hours_.toString(), "h ", mins_.toString(), "m remaining"));
    }

    function _addressShort(address a) internal pure returns (string memory) {
        return string(
            abi.encodePacked("0x", _toHex(uint16(uint160(a) >> 144)), "...", _toHex(uint16(uint160(a))))
        );
    }

    function _toHex(uint16 value) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(4);
        for (uint256 i = 0; i < 4; i++) {
            str[3 - i] = alphabet[value & 0xf];
            value >>= 4;
        }
        return string(str);
    }
}
